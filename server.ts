import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const REDIRECT_URI = `${APP_URL}/api/auth/google/callback`;

console.log('Drive Integration Configured with Redirect URI:', REDIRECT_URI);

const getOAuthClient = () => new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

// --- Google Drive Auth Routes ---

app.get('/api/auth/google/url', (req, res) => {
  const client = getOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent',
  });
  res.json({ url });
});

app.get('/api/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  console.log('Received Google Auth Callback');
  
  if (!code) {
    return res.status(400).send('Código de autorização ausente');
  }

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code as string);
    console.log('Successfully exchanged code for tokens');

    res.cookie('google_drive_tokens', JSON.stringify(tokens), {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_DRIVE_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Autenticação com Google Drive concluída! Esta janela fechará automaticamente.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in Google Callback:', error);
    res.status(500).send('Erro na autenticação');
  }
});

app.get('/api/auth/google/status', (req, res) => {
  const tokens = req.cookies.google_drive_tokens;
  res.json({ connected: !!tokens });
});

app.post('/api/sync/drive', async (req, res) => {
  const tokensStr = req.cookies.google_drive_tokens;
  if (!tokensStr) {
    return res.status(401).json({ error: 'Google Drive não conectado' });
  }

  const { projects, universes } = req.body;
  const tokens = JSON.parse(tokensStr);
  
  const client = getOAuthClient();
  client.setCredentials(tokens);

  const drive = google.drive({ version: 'v3', auth: client });

  try {
    // 1. Create or Find Root Folder
    let rootFolderId;
    const rootSearch = await drive.files.list({
      q: "name = 'My Manuscript Backup' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id)',
    });

    if (rootSearch.data.files?.length) {
      rootFolderId = rootSearch.data.files[0].id;
    } else {
      const rootFolder = await drive.files.create({
        requestBody: {
          name: 'My Manuscript Backup',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      rootFolderId = rootFolder.data.id;
    }

    // 2. Sync Logic: Organized Folders
    for (const uni of universes) {
      // Create Universe Folder
      const uniFolder = await drive.files.create({
        requestBody: {
          name: uni.title,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [rootFolderId!],
        },
        fields: 'id',
      });
      
      const uniProjects = projects.filter((p: any) => p.universeId === uni.id);
      for (const proj of uniProjects) {
        const projFolder = await drive.files.create({
          requestBody: {
            name: proj.title,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [uniFolder.data.id!],
          },
          fields: 'id',
        });

        // Add Content.txt
        await drive.files.create({
          requestBody: {
            name: 'Manuscrito.txt',
            parents: [projFolder.data.id!],
          },
          media: {
            mimeType: 'text/plain',
            body: proj.currentContent || '',
          },
        });
      }
    }

    // Handle Solo Stories
    const soloProjects = projects.filter((p: any) => !p.universeId);
    if (soloProjects.length > 0) {
      const soloFolder = await drive.files.create({
        requestBody: {
          name: 'Solo Stories',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [rootFolderId!],
        },
        fields: 'id',
      });

      for (const proj of soloProjects) {
        const projFolder = await drive.files.create({
          requestBody: {
            name: proj.title,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [soloFolder.data.id!],
          },
          fields: 'id',
        });

        await drive.files.create({
          requestBody: {
            name: 'Manuscrito.txt',
            parents: [projFolder.data.id!],
          },
          media: {
            mimeType: 'text/plain',
            body: proj.currentContent || '',
          },
        });
      }
    }

    res.json({ success: true, message: 'Estrutura de pastas sincronizada no Drive!' });
  } catch (error) {
    console.error('Drive Sync Error:', error);
    res.status(500).json({ error: 'Erro ao sincronizar com Google Drive' });
  }
});


// --- Vite Middleware ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
