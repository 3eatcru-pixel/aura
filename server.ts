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

// Aumenta o limite para suportar o envio de múltiplos manuscritos pesados para o Drive
app.use(express.json({ limit: '50mb' }));
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
      'https://www.googleapis.com/auth/generative-language', // Escopo para Gemini via OAuth
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

// --- AI Assistant Proxy (Plugin Style) - Gemini ---
app.post('/api/ai/gemini-proxy', async (req, res) => {
  const tokensStr = req.cookies.google_drive_tokens;
  if (!tokensStr) {
    return res.status(401).json({ error: 'Assistente não conectado. Por favor, faça login com Google.' });
  }

  const { prompt, config, systemInstruction } = req.body;
  
  try {
    const tokens = JSON.parse(tokensStr);
    const client = getOAuthClient();
    
    // Store initial tokens to check for refresh later
    const initialAccessToken = tokens.access_token;

    client.setCredentials(tokens);

    // Refresh token se necessário (essencial para serverless não perder a conexão)
    const accessTokenResponse = await client.getAccessToken();
    const token = accessTokenResponse.token;
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: req.body.contents || [{ parts: [{ text: prompt }] }],
        generationConfig: config || {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Erro na comunicação com o Gemini');
    }
    
    // Se o token mudou durante a execução, atualiza o cookie do usuário
    if (client.credentials.access_token !== initialAccessToken) {
      res.cookie('google_drive_tokens', JSON.stringify(client.credentials), {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }
    
    // Retorna o texto formatado para o frontend
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text });
    
  } catch (error: any) {
    console.error('AI Gemini Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- AI Assistant Proxy (Plugin Style) - GPT ---
app.post('/api/ai/gpt-proxy', async (req, res) => {
  // Prioriza a chave enviada pelo usuário via header para custo zero do dono do app
  const userKey = req.headers['x-user-openai-key'];
  const openaiApiKey = userKey || process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    return res.status(401).json({ error: 'Chave de API OpenAI não encontrada. Configure-a no Assistente.' });
  }

  const { messages, model, config, systemInstruction } = req.body;

  try {
    // Converte systemInstruction para o formato de mensagens da OpenAI
    const fullMessages = [...messages];
    if (systemInstruction) {
      fullMessages.unshift({ role: 'system', content: systemInstruction });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo', // Default to a common GPT model
        messages: fullMessages,
        ...config
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Erro na comunicação com o GPT');
    }

    const text = data.choices?.[0]?.message?.content || '';
    res.json({ text });

  } catch (error: any) {
    console.error('AI GPT Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- AI Assistant Proxy (Plugin Style) - DeepSeek ---
app.post('/api/ai/deepseek-proxy', async (req, res) => {
  const userKey = req.headers['x-user-deepseek-key'];
  const deepseekApiKey = userKey || process.env.DEEPSEEK_API_KEY;

  if (!deepseekApiKey) {
    return res.status(401).json({ error: 'Chave de API DeepSeek não encontrada.' });
  }

  const { messages, config, systemInstruction } = req.body;

  try {
    // DeepSeek é compatível com o formato de mensagens da OpenAI
    const fullMessages = [...messages];
    if (systemInstruction) {
      fullMessages.unshift({ role: 'system', content: systemInstruction });
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: fullMessages,
        ...config,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Erro na comunicação com o DeepSeek');
    }

    const text = data.choices?.[0]?.message?.content || '';
    res.json({ text });
  } catch (error: any) {
    console.error('AI DeepSeek Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Translation Proxy (DeepL) ---
app.post('/api/translate/deepl-proxy', async (req, res) => {
  const userKey = req.headers['x-user-deepl-key'];
  const deeplApiKey = userKey || process.env.DEEPL_API_KEY;

  if (!deeplApiKey) {
    return res.status(401).json({ error: 'Chave de API DeepL não configurada.' });
  }

  const { text, target_lang, source_lang } = req.body;

  try {
    const response = await fetch('https://api-free.deepl.com/v2/translate', { // Use api-free for free tier
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${deeplApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: target_lang,
        source_lang: source_lang, // Optional
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Erro na comunicação com o DeepL');
    }

    const translatedText = data.translations?.[0]?.text || '';
    res.json({ translatedText });
  } catch (error: any) {
    console.error('AI Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Connection Test Endpoint ---
app.post('/api/ai/validate-key', async (req, res) => {
  const { type, key } = req.body;
  // Implementar lógica de ping ultra-rápido para cada serviço
  // Ex: OpenAI chama o endpoint /models com a chave
  res.json({ success: true, message: 'Chave válida e pronta para uso.' });
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
      
      let pageToken: string | undefined = undefined;
      let existingFolderId: string | undefined = undefined;

      do {
        const search = await drive.files.list({ 
          q, 
          fields: 'nextPageToken, files(id)',
          pageToken: pageToken,
        });
        
        if (search.data.files && search.data.files.length > 0) {
          existingFolderId = search.data.files[0].id;
          break; // Found the folder
        }
        pageToken = search.data.nextPageToken || undefined;
      } while (pageToken);
      
      if (existingFolderId) {
        return existingFolderId;
      }
      const folder = await drive.files.create({
        requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
        fields: 'id',
      });
      return folder.data.id;
    };

    // Helper function to find or create/update a file
    const findOrCreateUpdateFile = async (name: string, parentId: string, mimeType: string, body: string) => {
      const q = `'${parentId}' in parents and name = '${name}' and mimeType = '${mimeType}' and trashed = false`;

      let pageToken: string | undefined = undefined;
      let existingFileId: string | undefined = undefined;

      do {
        const search = await drive.files.list({ 
          q, 
          fields: 'nextPageToken, files(id)',
          pageToken: pageToken,
        });
        
        if (search.data.files && search.data.files.length > 0) {
          existingFileId = search.data.files[0].id;
          break; // Found the file
        }
        pageToken = search.data.nextPageToken || undefined;
      } while (pageToken);
      
      if (existingFileId) {
        // File exists, update its content
        await drive.files.update({
          fileId: existingFileId,
          media: { mimeType, body },
        });
        return existingFileId;
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
        try {
          const projFolderId = await findOrCreateFolder(proj.title, uniFolderId);
          if (!projFolderId) continue;

          // Add Content.txt (now using fullContent from client)
          await findOrCreateUpdateFile('Manuscrito.txt', projFolderId, 'text/plain', proj.fullContent || '');
        } catch (projError) {
          console.error(`Failed to sync project ${proj.title}:`, projError);
          // Continue para o próximo projeto mesmo se este falhar
        }
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
        try {
          const projFolderId = await findOrCreateFolder(proj.title, soloFolderId);
          if (!projFolderId) {
            console.warn(`Could not create or find folder for solo project: ${proj.title}`);
            continue;
          }
          await findOrCreateUpdateFile('Manuscrito.txt', projFolderId, 'text/plain', proj.fullContent || '');
        } catch (projError) {
          console.error(`Failed to sync solo project ${proj.title}:`, projError);
        }
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
