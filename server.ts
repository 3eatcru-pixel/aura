import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { GoogleGenAI, Type } from '@google/genai';

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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

function mapMessageRole(role: string) {
  if (role === 'assistant') return 'model';
  if (role === 'user') return 'user';
  return role;
}

function createSystemInstruction() {
  return `Você é o "Scribe AI", uma inteligência de elite que atua como Diretor Criativo, Arquiteto de UX, Editor Narrativo e Lead QA.
  Sua função é co-criar e auditar o projeto do usuário com um olhar crítico e artístico.`;
}

async function aiRequest(payload: Parameters<typeof ai.models.generateContent>[0]) {
  return ai.models.generateContent(payload);
}

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

app.post('/api/ai/chat', async (req, res) => {
  const { messages, projectContext } = req.body;
  try {
    const formattedMessages = (messages || []).map((m: any) => ({
      role: mapMessageRole(m.role),
      parts: [{ text: m.text }]
    }));

    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: formattedMessages,
      config: {
        systemInstruction: `${createSystemInstruction()}\n\nContexto do projeto: ${projectContext}`
      }
    });

    res.json({ text: response.text || '' });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Erro ao processar mensagem de chat' });
  }
});

app.post('/api/ai/detect-characters', async (req, res) => {
  const { text, existingCharacters } = req.body;
  try {
    const prompt = `Analise o seguinte trecho de história e identifique nomes de personagens que aparecem.\nConsidere apenas personagens novos, ignorando os seguintes que já conhecemos: ${existingCharacters?.join(', ')}.\nRetorne apenas um array JSON de strings com os nomes.\n\nTexto: "${text}"`;
    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    res.json(JSON.parse(response.text || '[]'));
  } catch (error) {
    console.error('AI detect characters error:', error);
    res.status(500).json({ error: 'Erro ao detectar personagens' });
  }
});

app.post('/api/ai/get-writing-suggestion', async (req, res) => {
  const { context, currentContent, instruction } = req.body;
  try {
    const prompt = `Você é um assistente de escrita criativa (Scribe AI) de elite.\nCONTEXTO DA HISTÓRIA/LORE: ${context}\nCONTEÚDO ATUAL (últimas palavras): "...${currentContent}"\nINSTRUÇÃO DO ESCRITOR: ${instruction}\n\nOBJETIVO: Continue a narrativa de forma fluida.\nESTILO: Mantenha a voz e o tom estabelecidos no conteúdo atual.\nPERSONAGENS: Respeite as motivações e personalidades conhecidas do lore.\n\nREGRAS:\n1. Comece a continuação sem repetir o que já foi escrito.\n2. Forneça entre 1 e 3 parágrafos de alta qualidade literária.\n3. Não explique o que fez, apenas retorne o texto criativo.`;
    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: prompt
    });
    res.json({ text: response.text || '' });
  } catch (error) {
    console.error('AI writing suggestion error:', error);
    res.status(500).json({ error: 'Erro ao gerar sugestão de escrita' });
  }
});

app.post('/api/ai/analyze-manuscript', async (req, res) => {
  const { content, context, mode, lore } = req.body;
  try {
    let prompt = '';
    if (mode === 'improvements') {
      prompt = `Você é um editor literário experiente. Analise o seguinte trecho de manuscrito e sugira melhorias em termos de estilo, ritmo, gramática e clareza.\n       Contexto do Projeto: ${context}\n       Retorne um array JSON de objetos com: { \"id\": string, \"type\": \"grammar\"|\"style\", \"originalText\": string, \"suggestedText\": string, \"explanation\": string }.\n       Inclua no máximo 5 sugestões críticas. Se não houver o que melhorar, retorne um array vazio.\n       \n       Texto: "${content}"`;
    } else if (mode === 'consistency') {
      prompt = `Você é um revisor de continuidade (continuity checker) de elite. \n       COMPÊNDIO/LORE DE REFERÊNCIA: ${lore || context}\n       \n       TAREFA: Verifique se há inconsistências no texto abaixo em relação ao lore estabelecido (personagens, fatos, geografia, regras de magia).\n       Exemplos: Personagem que estava em um lugar aparecer em outro sem explicação, mudança súbita de poder, erro de cronologia.\n\n       Retorne um array JSON de objetos com: { \"id\": string, \"type\": \"consistency\"|\"plot\", \"originalText\": string, \"suggestedText\": string, \"explanation\": string }.\n       Lógica: O originalText deve ser o trecho problemático.\n\n       Texto para Análise: "${content}"`;
    } else if (mode === 'show-don-t-tell') {
      prompt = `Você é um mentor de escrita criativa focado na técnica "Mostre, Não Conte" (Show, Don't Tell). \n       Analise o texto e identifique trechos onde o autor está "contando" emoções ou estados (ex: "Ele estava triste") em vez de "mostrar" através de ações, sensações ou diálogos.\n       Contexto do Projeto: ${context}\n       Retorne um array JSON de objetos com: { \"id\": string, \"type\": \"style\", \"originalText\": string, \"suggestedText\": string, \"explanation\": string }.\n       No \"suggestedText\", forneça um exemplo de como mostrar aquela mesma cena.\n\n       Texto: "${content}"`;
    }
    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING },
              originalText: { type: Type.STRING },
              suggestedText: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ['id', 'type', 'originalText', 'suggestedText', 'explanation']
          }
        }
      }
    });
    res.json(JSON.parse(response.text || '[]'));
  } catch (error) {
    console.error('AI analyze manuscript error:', error);
    res.status(500).json({ error: 'Erro ao analisar manuscrito' });
  }
});

app.post('/api/ai/deep-character-design', async (req, res) => {
  const { name, storyContext } = req.body;
  try {
    const prompt = `Desenvolva profundamente o personagem "${name}" baseado no contexto: ${storyContext}.\n  \n  Crie:\n  1. Descrição Visual (Visual Description)\n  2. Traços de Personalidade (Personality Traits)\n  3. Objetivos Principais (Main Goals)\n  4. Medos e Trauma (Fears and Traumas)\n  5. Tom de Voz/Estilo de Fala (Vocal Tone)\n  6. Resumo Biográfico (History)\n\n  Retorne um objeto JSON com estas chaves em português: description, traits, goals, fears, vocalTone, history.`;
    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (error) {
    console.error('AI deep character design error:', error);
    res.status(500).json({ error: 'Erro ao gerar design de personagem' });
  }
});

app.post('/api/ai/research-topic', async (req, res) => {
  const { query: searchQuery } = req.body;
  try {
    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: `Pesquise sobre o seguinte tópico para um escritor de ficção: ${searchQuery}. \n      Forneça fatos interessantes, detalhes sensoriais e informações históricas ou técnicas relevantes que possam enriquecer uma cena.\n      Use uma linguagem inspiradora e organizada.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    res.json({ text: response.text || '' });
  } catch (error) {
    console.error('AI research topic error:', error);
    res.status(500).json({ error: 'Erro ao pesquisar tópico' });
  }
});

app.post('/api/ai/generate-auto-character-lore', async (req, res) => {
  const { name, storyContext } = req.body;
  try {
    const prompt = `Crie uma breve descrição (lore) e traços de personalidade para o personagem "${name}" baseado no que foi escrito até agora: ${storyContext}.\n  Retorne um objeto JSON com "description" e "traits".`;
    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            traits: { type: Type.STRING }
          },
          required: ['description', 'traits']
        }
      }
    });
    res.json(JSON.parse(response.text || '{"description":"","traits":""}'));
  } catch (error) {
    console.error('AI generate auto character lore error:', error);
    res.status(500).json({ error: 'Erro ao gerar lore de personagem' });
  }
});

app.post('/api/ai/process-lore-draft', async (req, res) => {
  const { draft } = req.body;
  try {
    const prompt = `Você é um curador de Lore de universos literários. \n  Analise o rascunho abaixo e separe-o em entradas individuais de lore. \n  Cada entrada deve ter um título, conteúdo e uma das categorias: 'world', 'lore', 'rpg', 'item', 'magic', 'faction', 'timeline' ou 'note'.\n  'world' é para geografia, locais, atlas.\n  'lore' é para história, mitos, cultura.\n  'faction' é para grupos, organizações, facções, povoados.\n  'timeline' é para sequências de eventos, cronologia, eras.\n  'rpg' é para mecânicas, regras de sistema, estatísticas.\n  'item' é para armas, artefatos, objetos funcionais.\n  'magic' é para feitiços, magias, rituais.\n  'note' é para observações soltas.\n  \n  Retorne um array JSON de objetos.\n  \n  Rascunho: "${draft}"`;
    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              category: { type: Type.STRING, enum: ['world', 'lore', 'note', 'rpg', 'item', 'magic', 'faction', 'timeline'] }
            },
            required: ['title', 'content', 'category']
          }
        }
      }
    });
    res.json(JSON.parse(response.text || '[]'));
  } catch (error) {
    console.error('AI process lore draft error:', error);
    res.status(500).json({ error: 'Erro ao processar rascunho de lore' });
  }
});

app.post('/api/ai/architect-lore', async (req, res) => {
  const { type, details, context } = req.body;
  try {
    const prompts: Record<string, string> = {
      location: `Crie um local detalhado para um universo fictício. Foco em: detalhes sensoriais, importância estratégica e segredos ocultos.`,
      event: `Crie um evento histórico ou mito para este universo. Foco em: causas, impacto no presente e como é lembrado.`,
      system: `Desenvolva um sistema (magia, economia, governo ou religião). Foco em: regras, limitações e impacto social.`,
      atmosphere: `Descreva o ambiente/clima de uma cena ou região. Foco em: imersão, sentimentos evocados e detalhes visuais.`,
      faction: `Crie uma facção, grupo ou guilda. Foco em: ideologia, hierarquia, influência no mundo e segredos.`,
      timeline: `Crie uma linha do tempo ou sequência de eventos chave. Foco em: marcos históricos, eras e transições de poder.`
    };
    const prompt = `Você é o Scribe Architect. ${prompts[type] || prompts.location}\n  Contexto do Universo/Projeto: ${context}\n  Baseado nestas ideias iniciais: "${details}"\n  \n  IMPORTANTE: Se o personagem, local ou conceito já existir no contexto acima, não crie um novo do zero. Em vez disso, expanda a história existente, adicione novos detalhes, segredos ou desenvolvimentos que façam sentido.\n  \n  Retorne um objeto JSON com: { "title": string, "content": string, "category": "world"|"lore"|"note"|"rpg"|"item"|"magic"|"faction"|"timeline" }.`;
    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (error) {
    console.error('AI architect lore error:', error);
    res.status(500).json({ error: 'Erro ao arquitetar lore' });
  }
});

app.post('/api/ai/get-autocomplete', async (req, res) => {
  const { context, textBefore, textAfter } = req.body;
  try {
    const prompt = `Você é um co-piloto de escrita criativa (Scribe AI). \n  Objetivo: Sugerir a continuação IMEDIATA da frase ou parágrafo de forma ultra-concisa e natural.\n  \n  CONTEXTO DO PROJETO: ${context}\n  TEXTO ANTES DO CURSOR: "${textBefore}"\n  TEXTO DEPOIS DO CURSOR: "${textAfter}"\n  \n  REGRAS:\n  1. Retorne APENAS a sugestão (de 1 a 10 palavras no máximo).\n  2. A sugestão deve completar o que o autor está escrevendo.\n  3. Não repita o que já foi escrito.\n  4. Respeite o tom e estilo do autor.\n  5. Se o texto antes termina em meio a uma palavra, complete-a.\n  6. Retorne string vazia se não houver uma continuação óbvia ou inspirada.`;
    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: prompt
    });
    res.json({ text: (response.text || '').trim().replace(/['"]/g, '') });
  } catch (error) {
    console.error('AI autocomplete error:', error);
    res.status(500).json({ error: 'Erro ao gerar autocomplete' });
  }
});

app.post('/api/ai/get-synonyms', async (req, res) => {
  const { word, sentence, context } = req.body;
  try {
    const prompt = `Sugira 5 sinônimos contextuais para a palavra "${word}" na seguinte frase: "${sentence}".\n  Considere o contexto literário do projeto: ${context}.\n  Os sinônimos devem elevar o vocabulário e manter ou aprimorar o tom emocional.\n  Retorne apenas um array JSON de strings.`;
    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    res.json(JSON.parse(response.text || '[]'));
  } catch (error) {
    console.error('AI get synonyms error:', error);
    res.status(500).json({ error: 'Erro ao obter sinônimos' });
  }
});

app.post('/api/ai/get-panel-suggestions', async (req, res) => {
  const { projectContext, currentPanels, count = 3 } = req.body;
  try {
    const currentPanelsText = (currentPanels || []).map((p: any) => `[${p.title}]: ${p.description || 'Sem descrição'}`).join('\n');
    const prompt = `Você é um story boarder e roteirista de Mangá, HQ e Cinema de elite.\n  CONTEXTO DO PROJETO: ${projectContext}\n  TIPO DE PROJETO: Roteiro Cinematográfico / Storyboard Visual.\n  \n  PAINÉIS/CENAS ATUAIS:\n  ${currentPanelsText}\n  \n  OBJETIVO: Sugerir ${count} próximos frames/painéis para continuar a sequência narrativa. \n  Considere o ritmo (pacing), enquadramentos cinematográficos (close-up, wide shot, bird's eye view) e a continuidade emocional.\n  \n  PARA CADA SUGESTÃO, FORNEÇA:\n  1. Título/ID (ex: CENA 1 - SHOT 4)\n  2. Descrição Visual (composição, luz, movimento de câmera)\n  3. Texto/Diálogo associado\n  \n  Retorne um array JSON de objetos: { \"title\": string, \"description\": string }.`;
    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ['title', 'description']
          }
        }
      }
    });
    res.json(JSON.parse(response.text || '[]'));
  } catch (error) {
    console.error('AI get panel suggestions error:', error);
    res.status(500).json({ error: 'Erro ao obter sugestões de painel' });
  }
});

app.post('/api/ai/refine-panel-description', async (req, res) => {
  const { projectContext, currentDescription, instruction } = req.body;
  try {
    const prompt = `Melhore ou refine a descrição visual deste painel/scene.\n  CONTEXTO DO PROJETO: ${projectContext}\n  DESCRIÇÃO ATUAL: "${currentDescription}"\n  PEDIDO DO AUTOR: "${instruction}"\n  \n  Torne a linguagem mais cinematográfica, técnica e evocativa. Foque em detalhes sensoriais e enquadramento.\n  Retorne apenas o texto da descrição aprimorada.`;
    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: prompt
    });
    res.json({ text: (response.text || '').trim() });
  } catch (error) {
    console.error('AI refine panel description error:', error);
    res.status(500).json({ error: 'Erro ao refinar descrição de painel' });
  }
});

app.post('/api/ai/generate-storyboard-from-text', async (req, res) => {
  const { projectContext, manuscript } = req.body;
  try {
    const prompt = `Você é um story boarder e diretor cinematográfico de elite.\n  CONTEXTO DO PROJETO: ${projectContext}\n  MANUSCRITO:\n  ${manuscript.slice(0, 8000)}\n  \n  OBJETIVO: Transformar este texto em um Storyboard visual (sequência lógica de painéis).\n  Identifique as cenas mais impactantes e crie descrições visuais para os painéis.\n  \n  REGRAS:\n  1. No mínimo 5 e no máximo 12 painéis.\n  2. Distribua entre páginas se houver muita ação.\n  3. Descreva enquadramento, ação e iluminação.\n  \n  Retorne um array JSON: [{ \"title\": string, \"description\": string, \"pageNumber\": number }].`;
    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              pageNumber: { type: Type.NUMBER }
            },
            required: ['title', 'description', 'pageNumber']
          }
        }
      }
    });
    res.json(JSON.parse(response.text || '[]'));
  } catch (error) {
    console.error('AI generate storyboard error:', error);
    res.status(500).json({ error: 'Erro ao gerar storyboard' });
  }
});

app.post('/api/ai/run-intelligent-audit', async (req, res) => {
  const { manuscript, loreContext, projectMetadata } = req.body;
  try {
    const prompt = `Você é uma ENTIDADE DE ELITE: Diretor Criativo, Arquiteto de UX e Lead QA de um sistema operacional narrativo de alta fidelidade.\n  Sua missão é realizar uma AUDITORIA IMPLACÁVEL e ARTÍSTICA no projeto abaixo.\n\n  DADOS DO PROJETO:\n  Título: ${projectMetadata.title}\n  Lore/Canon Base: ${loreContext}\n  Manuscrito Atual (Trecho): ${manuscript.slice(-15000)}\n\n  SUA AUDITORIA DEVE COBRIR 6 DIMENSÕES CRÍTICAS:\n\n  1. UX/UI (O Fluxo do Criador):\n     - Analise a ergonomia da narrativa. Há excesso de exposição (info-dumping)?\n     - O editor está servindo ao foco do usuário? (Foque na estrutura da cena).\n\n  2. NARRATIVA (Canon Shield):\n     - DETECTE CONTRADIÇÕES: Alguma regra do universo foi quebrada?\n     - Algum evento contradiz o Lore Base fornecido? Se sim, marque como CRITICAL.\n\n  3. PERSONAGEM (Psicologia e Evolução):\n     - Verifique se a voz do personagem é consistente.\n     - Detecte ações que fujam da personalidade estabelecida sem justificativa emocional.\n\n  4. VISUAL (Composição e Ritmo):\n     - Avalie a densidade de painéis (se for mangá) ou a cadência de parágrafos.\n     - A leitura é fluida ou exaustiva?\n\n  5. TÉCNICA (Integridade Sistêmica):\n     - Performance narrativa: capítulos muito longos ou curtos demais?\n     - Furos de roteiro (plot holes) evidentes.\n\n  6. EMOCIONAL (Emotional Flow Analysis):\n     - Detecte quedas de tensão, diálogos repetitivos ou falta de "punch" emocional.\n     - Identifique momentos onde o ritmo arrasta desnecessariamente.\n\n  SAÍDA ESPERADA (JSON RIGOROSO):\n  {\n    \"id\": string (UUID),\n    \"overallScore\": number (0-100),\n    \"metrics\": {\n      \"uxEfficiency\": number,\n      \"narrativeCohesion\": number,\n      \"characterDepth\": number,\n      \"visualClarity\": number,\n      \"technicalHealth\": number,\n      \"emotionalImpact\": number\n    },\n    \"issues\": [\n      {\n        \"id\": string,\n        \"category\": \"UX\"|\"Narrative\"|\"Character\"|\"Visual\"|\"Technical\"|\"Emotional\",\n        \"priority\": \"low\"|\"medium\"|\"high\"|\"critical\",\n        \"title\": string,\n        \"description\": string,\n        \"suggestion\": string,\n        \"location\": string (ex: \"Capítulo 5\", \"Painel 2\", \"Diálogo Inicial\")\n      }\n    ]\n  }\n\n  REGRAS DE OURO:\n  - Seja um Editor de verdade: Se o texto estiver ruim, diga. Se o nexo quebrou, bloqueie.\n  - O \"Canon Shield\" é sua prioridade máxima.\n  - Use um tom profissional, sofisticado e visionário.`;
    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });
    const report = JSON.parse(response.text || 'null');
    if (report) report.timestamp = new Date();
    res.json(report);
  } catch (error) {
    console.error('AI run intelligent audit error:', error);
    res.status(500).json({ error: 'Erro ao executar auditoria inteligente' });
  }
});

app.post('/api/ai/run-cinematic-director', async (req, res) => {
  const { sceneDescription, projectContext, mood } = req.body;
  try {
    const prompt = `Você é um Diretor de Fotografia e Storyboarder de elite especializado em Mangá e Cinema Noir/Cinematográfico.\n  Sua missão é dirigir visualmente a seguinte cena.\n  \n  CONTEXTO DO PROJETO: ${projectContext}\n  DESCRIÇÃO DA CENA: "${sceneDescription}"\n  MOOD/EMOÇÃO DESEJADA: ${mood}\n\n  REGRAS DE DIREÇÃO:\n  1. Sugira o enquadramento ideal (Close-up, Extreme Wide, Dutch Angle, etc).\n  2. Sugira a iluminação e contraste (Chiaroscuro, High Key, Sombra dramática).\n  3. Descreva a composição do quadro (Arquitetura, profundidade de campo).\n  4. Sugira o tipo de balão de fala se houver diálogo.\n\n  Retorne um objeto JSON:\n  {\n    \"cameraAngle\": string,\n    \"shotType\": string,\n    \"lighting\": string,\n    \"composition\": string,\n    \"emotionalNote\": string,\n    \"balloonType\": \"normal\"|\"scream\"|\"thought\"|\"whisper\"|\"glitch\"\n  }`;
    const response = await aiRequest({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (error) {
    console.error('AI run cinematic director error:', error);
    res.status(500).json({ error: 'Erro ao executar diretor cinematográfico' });
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
