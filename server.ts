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

  let tokens;
  try {
    tokens = JSON.parse(tokensStr);
  } catch (parseError) {
    console.error('Error parsing Google Drive tokens from cookie:', parseError);
    return res.status(400).json({ error: 'Tokens de autenticação inválidos' });
  }

  const { projects, universes } = req.body;
  
  const client = getOAuthClient();
  client.setCredentials(tokens);

  const drive = google.drive({ version: 'v3', auth: client });

  try {
    // Helper function to find or create a folder
    const findOrCreateFolder = async (name: string, parentId: string | null = null) => {
      const q = parentId ? `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false` : `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const search = await drive.files.list({ q, fields: 'files(id)' });
      if (search.data.files && search.data.files.length > 0) {
        return search.data.files[0].id;
      }
      const folder = await drive.files.create({
        requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
        fields: 'id',
      });
      return folder.data.id;
    };

    // Helper function to find or create/update a file
    const findOrCreateUpdateFile = async (name: string, parentId: string, mimeType: string, body: string) => {
      const q = `'${parentId}' in parents and name = '${name}' and trashed = false`;
      const search = await drive.files.list({ q, fields: 'files(id)' });
      
      if (search.data.files && search.data.files.length > 0) {
        // File exists, update its content
        await drive.files.update({
          fileId: search.data.files[0].id!,
          media: { mimeType, body },
        });
        return search.data.files[0].id;
      } else {
        // File does not exist, create it
        const file = await drive.files.create({
          requestBody: { name, parents: [parentId] },
          media: { mimeType, body },
          fields: 'id',
        });
        return file.data.id;
      }
    };

    // 1. Create or Find Root Folder
    const rootFolderId = await findOrCreateFolder('My Manuscript Backup');
    if (!rootFolderId) {
      throw new Error('Could not create or find root folder.');
    }

    // 2. Sync Logic: Organized Folders
    for (const uni of universes) {
      // Create Universe Folder
      const uniFolderId = await findOrCreateFolder(uni.title, rootFolderId);
      if (!uniFolderId) {
        console.warn(`Could not create or find folder for universe: ${uni.title}`);
        continue; // Skip this universe if folder cannot be created
      }
      
      const uniProjects = projects.filter((p: any) => p.universeId === uni.id);
      for (const proj of uniProjects) {
        const projFolderId = await findOrCreateFolder(proj.title, uniFolderId);
        if (!projFolderId) {
          console.warn(`Could not create or find folder for project: ${proj.title} in universe: ${uni.title}`);
          continue;
        }

        // Add Content.txt
        await findOrCreateUpdateFile('Manuscrito.txt', projFolderId, 'text/plain', proj.currentContent || '');
      }
    }

    // Handle Solo Stories
    const soloProjects = projects.filter((p: any) => !p.universeId);
    if (soloProjects.length > 0) {
      const soloFolderId = await findOrCreateFolder('Solo Stories', rootFolderId);
      if (!soloFolderId) {
        console.warn('Could not create or find Solo Stories folder.');
      }

      for (const proj of soloProjects) {
        const projFolderId = await findOrCreateFolder(proj.title, soloFolderId);
        if (!projFolderId) {
          console.warn(`Could not create or find folder for solo project: ${proj.title}`);
          continue;
        }
        await findOrCreateUpdateFile('Manuscrito.txt', projFolderId, 'text/plain', proj.currentContent || '');
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
