import express from 'express';
import { getOAuthClient } from './googleAuth';

const router = express.Router();

router.get('/url', (req, res) => {
  const client = getOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/generative-language',
    ],
    prompt: 'consent',
  });
  res.json({ url });
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Código de autorização ausente');

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code as string);

    res.cookie('google_drive_tokens', JSON.stringify(tokens), {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.send(`
      <html>
        <body style="background: #050505; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_DRIVE_AUTH_SUCCESS' }, '*');
              window.close();
            } else { window.location.href = '/'; }
          </script>
          <div style="text-align: center;">
            <h2 style="color: #eab308;">Conectado com Sucesso</h2>
            <p style="opacity: 0.6;">Sua conta Google Drive foi vinculada ao Oráculo.</p>
            <p>Você pode fechar esta aba.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('[AUTH] Google Callback Error:', error);
    res.status(500).send('Erro na autenticação');
  }
});

router.get('/status', (req, res) => {
  const tokens = req.cookies.google_drive_tokens;
  res.json({ connected: !!tokens });
});

export default router;
