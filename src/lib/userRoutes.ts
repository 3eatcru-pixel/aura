import express from 'express';
import admin from 'firebase-admin';
import { authenticateUser, AuthenticatedRequest } from './auth';

const router = express.Router();
const adminDb = admin.firestore();

/**
 * Consulta estatísticas rápidas do autor
 */
router.get('/author-stats/:userId', authenticateUser, async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;
  if (req.user?.uid !== userId) return res.status(403).json({ error: 'unauthorized' });

  try {
    const authorSnap = await adminDb.collection('users').doc(userId).get();
    const data = authorSnap.data();
    res.json({ 
      stats: {
        earnedBRL: data?.balanceBRL || 0, 
        pendingCoins: data?.totalCoinsEarned || 0 
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Configurações de Payout (Chave PIX e Limite)
 */
router.post('/payout-settings', authenticateUser, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.uid;
  const { pixKey, payoutThresholdBRL, fullName } = req.body;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  try {
    await adminDb.collection('users').doc(userId).set({
      pixKey: pixKey || null,
      fullName: fullName || null,
      payoutThresholdBRL: payoutThresholdBRL !== undefined ? Number(payoutThresholdBRL) : 50,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/payout-settings/:userId', authenticateUser, async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;
  if (req.user?.uid !== userId) return res.status(403).json({ error: 'unauthorized' });

  try {
    const userSnap = await adminDb.collection('users').doc(userId).get();
    const data = userSnap.exists ? userSnap.data() : {};
    res.json({ 
      user: {
        pixKey: data?.pixKey,
        fullName: data?.fullName,
        payoutThresholdBRL: data?.payoutThresholdBRL || 50
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Saldo da Carteira (Moedas para leitura)
 */
router.get('/wallet/:userId', authenticateUser, async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;
  if (req.user?.uid !== userId) return res.status(403).json({ error: 'unauthorized' });

  try {
    const walletSnap = await adminDb.collection('wallets').doc(userId).get();
    res.json({ wallet: walletSnap.exists ? walletSnap.data() : { balanceCoins: 0 } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
