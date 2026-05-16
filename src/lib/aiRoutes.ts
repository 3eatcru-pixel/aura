import express from 'express';
import { getGemini } from './gemini';
import { authenticateUser, AuthenticatedRequest } from './auth';

const router = express.Router();

router.post('/chat', authenticateUser, async (req: AuthenticatedRequest, res) => {
  const { messages, context } = req.body;
  
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Mensagens ausentes ou inválidas.' });
  }

  try {
    const systemInstruction = `Você é o assistente criativo da AURA, uma plataforma profissional de escrita de romances, mangás e universos narrativos. 
Seu objetivo é ajudar autores com:
1. Brainstorming de ideias.
2. Desenvolvimento de personagens.
3. Consistência de lore.
4. Expansão de cenas.
5. Crítica construtiva.

Contexto do Projeto: ${JSON.stringify(context || {})}`;

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction: systemInstruction as any
      }
    });

    res.json({ content: response.text });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'Erro ao processar sua solicitação no servidor de IA.' });
  }
});

export default router;
