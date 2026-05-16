import express from 'express';
import admin from 'firebase-admin';
import { getStripe } from './stripe';

const adminDb = admin.firestore();

async function handleSuccessfulPayment(userId: string, coins: number, amountBRL: number, packageId: string, stripeSessionId: string) {
  const walletRef = adminDb.collection('wallets').doc(userId);
  const purchaseRef = adminDb.collection('purchases').doc(`stripe_${stripeSessionId}`);
  
  try {
    await adminDb.runTransaction(async (t) => {
      const walletSnap = await t.get(walletRef);
      const currentBalance = walletSnap.exists ? (walletSnap.data()?.balanceCoins || 0) : 0;
      
      t.set(walletRef, { 
        balanceCoins: currentBalance + coins, 
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      }, { merge: true });

      t.set(purchaseRef, {
        userId,
        packageId,
        amountCoins: coins,
        amountBRL,
        status: 'completed',
        provider: 'stripe',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    console.log(`[FINANCE] Crédito de ${coins} moedas aplicado ao usuário ${userId}`);
  } catch (error) {
    console.error('[FINANCE] Erro crítico ao processar pagamento:', error);
  }
}

export const stripeWebhookHandler = async (req: express.Request, res: express.Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (err: any) {
    console.error(`[BILLING] Webhook Signature Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const { userId, coins, amountBRL, packageId } = session.metadata;
    
    console.log(`[BILLING] Pagamento aprovado! Sessão: ${session.id}, Usuário: ${userId}`);
    await handleSuccessfulPayment(userId, Number(coins), Number(amountBRL), packageId, session.id);
  }

  res.json({ received: true });
};
