import express from 'express';
import admin from 'firebase-admin';
import { getStripe } from './stripe';
import crypto from 'crypto';
import { authenticateUser, AuthenticatedRequest } from './auth';

const router = express.Router();
const adminDb = admin.firestore();
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

/**
 * Inicia checkout no Stripe para compra de pacotes de moedas
 */
router.post('/create-checkout-session', async (req, res) => {
  const { userId, packageId, coins, amountBRL } = req.body;
  
  if (!userId || !packageId || !coins || !amountBRL) {
    return res.status(400).json({ error: 'Parâmetros de compra incompletos.' });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'pix'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: {
            name: `${coins} Moedas AUDTRILHA`,
            description: `Créditos para desbloqueio de capítulos e suporte a criadores.`,
          },
          unit_amount: Math.round(Number(amountBRL) * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${APP_URL}/?payment=success`,
      cancel_url: `${APP_URL}/?payment=cancel`,
      metadata: { userId, packageId, coins: String(coins), amountBRL: String(amountBRL) },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Compra de capítulo individual usando moedas da carteira
 */
router.post('/purchase-chapter', authenticateUser, async (req: AuthenticatedRequest, res: express.Response) => {
  const { projectId, chapterId } = req.body;
  const userId = req.user?.uid;

  if (!projectId || !chapterId || !userId) return res.status(400).json({ error: 'missing_fields' });

  try {
    const chapterRef = adminDb.doc(`projects/${projectId}/chapters/${chapterId}`);
    const chapterSnap = await chapterRef.get();
    if (!chapterSnap.exists) return res.status(404).json({ error: 'chapter_not_found' });

    const priceCoins = Number(chapterSnap.data()?.priceCoins ?? 0);
    if (!Number.isFinite(priceCoins) || priceCoins <= 0) return res.status(400).json({ error: 'invalid_price' });

    const projectRef = adminDb.doc(`projects/${projectId}`);
    const projectSnap = await projectRef.get();
    const ownerId = projectSnap.data()?.ownerId;
    if (!ownerId) return res.status(404).json({ error: 'owner_not_found' });

    // Cálculo de taxas (BYOK Financeiro)
    const configSnap = await adminDb.collection('settings').doc('monetization').get();
    const config = configSnap.data();
    const feePercent = config?.platformFeePercent ?? 10;
    const coinValueBRL = config?.coinValueBRL ?? 0.099; // R$ 0,099 por moeda por padrão
    
    // Conversão teórica para BRL para o saldo do autor
    const grossBRL = priceCoins * coinValueBRL;
    const netBRL = grossBRL * ((100 - feePercent) / 100);

    const purchaseId = `chap_purch_${userId}_${chapterId}`;
    const purchaseRef = adminDb.collection('purchases').doc(purchaseId);
    const walletRef = adminDb.collection('wallets').doc(userId);

    const result = await adminDb.runTransaction(async (t) => {
      const walletSnap = await t.get(walletRef);
      const current = walletSnap.exists ? (walletSnap.data()?.balanceCoins || 0) : 0;

      if (current < priceCoins) throw new Error('insufficient_funds');

      // 1. Deduz moedas do leitor
      t.set(walletRef, { 
        balanceCoins: current - priceCoins, 
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      }, { merge: true });
      
      // 2. Credita saldo BRL e Moedas Vitalícias do Autor
      const authorRef = adminDb.collection('users').doc(ownerId);
      t.set(authorRef, { 
        balanceBRL: admin.firestore.FieldValue.increment(netBRL),
        totalCoinsEarned: admin.firestore.FieldValue.increment(priceCoins),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // 3. Registra log de transação
      t.set(purchaseRef, {
        id: purchaseId,
        userId,
        projectId,
        chapterId,
        amountCoins: priceCoins,
        status: 'completed',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 4. Atualiza Estatísticas da Obra (Analytics)
      const statsRef = adminDb.collection('work_stats').doc(projectId);
      t.set(statsRef, {
        unlocks: admin.firestore.FieldValue.increment(1),
        revenueBRL: admin.firestore.FieldValue.increment(netBRL),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // 5. Atualiza dados denormalizados no Catálogo
      const pubWorkRef = adminDb.collection('published_works').doc(projectId);
      t.set(pubWorkRef, {
        'stats.totalRevenueCoins': admin.firestore.FieldValue.increment(priceCoins),
        'stats.uniqueReaders': admin.firestore.FieldValue.increment(1) // Simplificado: idealmente checar se é a primeira compra
      }, { merge: true });

      return { newBalance: current - priceCoins };
    });

    res.json({ success: true, purchaseId, newBalance: result.newBalance });
  } catch (err: any) {
    if (err.message === 'insufficient_funds') return res.status(402).json({ error: 'insufficient_funds' });
    res.status(500).json({ error: err.message || 'server_error' });
  }
});

/**
 * Solicitação de Payout (Saque) do Autor
 */
router.post('/request-payout', authenticateUser, async (req: AuthenticatedRequest, res: express.Response) => {
  const userId = req.user?.uid;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  try {
    const userRef = adminDb.doc(`users/${userId}`);
    const configSnap = await adminDb.collection('settings').doc('monetization').get();
    const minPayout = configSnap.data()?.minPayoutBRL || 50;

    const result = await adminDb.runTransaction(async (t) => {
      const userSnap = await t.get(userRef);
      const data = userSnap.data();
      const balance = data?.balanceBRL || 0;

      if (balance < minPayout) throw new Error('insufficient_balance');
      if (!data?.pixKey || !data?.fullName) throw new Error('missing_payout_info');

      const payoutId = `pay_${crypto.randomUUID()}`;
      const payoutRef = adminDb.collection('payouts').doc(payoutId);

      // 1. Cria o registro de Payout
      t.set(payoutRef, {
        id: payoutId,
        authorId: userId,
        authorEmail: data.email,
        amountBRL: balance,
        pixKey: data.pixKey,
        status: 'pending',
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        estimatedArrival: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // +5 dias
      });

      // 2. Zera o saldo do autor e registra o débito
      t.update(userRef, { 
        balanceBRL: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { payoutId };
    });

    res.json({ success: true, payoutId: result.payoutId });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Consulta histórico de saques (payouts) do autor
 */
router.get('/payouts/:userId', authenticateUser, async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;
  if (req.user?.uid !== userId) return res.status(403).json({ error: 'unauthorized' });

  try {
    const snap = await adminDb.collection('payouts')
      .where('authorId', '==', userId)
      .orderBy('requestedAt', 'desc')
      .get();
    res.json({ payouts: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Histórico de compras do usuário
 */
router.get('/purchases/:userId', authenticateUser, async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;
  if (req.user?.uid !== userId) return res.status(403).json({ error: 'unauthorized' });
  try {
    const snap = await adminDb.collection('purchases')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    res.json({ purchases: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;