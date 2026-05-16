import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs/promises';
import admin from 'firebase-admin';

async function startServer() {
  dotenv.config();

  // 1. Initialize Firebase Admin
  try {
    if (!admin.apps.length) {
      const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      const firebaseConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: firebaseConfig.projectId,
        databaseURL: `https://${firebaseConfig.projectId}.firebaseio.com`
      });
      console.log('[CORE] Firebase Admin initialized');
    }
  } catch (e: any) {
    console.error('[CRITICAL] Admin initialization failed:', e?.message || e);
  }

  // 2. Import Route Handlers (Dynamic needed because they depend on admin-init)
  const { stripeWebhookHandler } = await import('./src/lib/stripeWebhook');
  const googleAuthRouter = (await import('./src/lib/googleAuthRouter')).default;
  const aiRoutes = (await import('./src/lib/aiRoutes')).default;
  const syncRoutes = (await import('./src/lib/syncRoutes')).default; 
  const userRoutes = (await import('./src/lib/userRoutes')).default;
  const billingRoutes = (await import('./src/lib/billingRoutes')).default;
  const publishRoutes = (await import('./src/lib/publishRoutes')).default;
  const adminRoutes = (await import('./src/routes/adminRoutes')).default;

  const app = express();
  const PORT = 3000;
  const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const DIST_DIR = path.resolve(process.cwd(), 'dist');

  // 3. Middlewares
  app.use(helmet({
    contentSecurityPolicy: false, // For development and iframe ease
  }));
  app.use(cors({ origin: APP_URL, credentials: true }));

  // Webhook must be BEFORE express.json() for signature verification
  app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // 4. API Routes
  app.use('/api/auth/google', googleAuthRouter);
  app.use('/api/sync', syncRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/publish', publishRoutes);
  app.use('/api/admin', adminRoutes);

  // 5. Frontend / Development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(DIST_DIR));
    app.get('*', (req, res) => {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  }
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CORE] Server active at ${APP_URL} (Port ${PORT})`);
  });
}

startServer().catch(err => {
  console.error('[FATAL] Bootstrap failed:', err);
  process.exit(1);
});
