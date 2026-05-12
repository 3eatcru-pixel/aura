import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function detectCharacters(text: string, existingCharacters: string[]) {
  const prompt = `Analise o seguinte trecho de história e identifique nomes de personagens que aparecem. 
  Considere apenas personagens novos, ignorando os seguintes que já conhecemos: ${existingCharacters.join(', ')}.
  Retorne apenas um array JSON de strings com os nomes.
  
  Texto: "${text}"`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    return JSON.parse(response.text || "[]") as string[];
  } catch (error) {
    console.error("Error detecting characters:", error);
    return [];
  }
}

export async function getWritingSuggestion(context: string, currentContent: string, instruction: string) {
  const prompt = `Você é um assistente de escrita criativa (Scribe AI) de elite. 
  CONTEXTO DA HISTÓRIA/LORE: ${context}
  CONTEÚDO ATUAL (últimas palavras): "...${currentContent}"
  INSTRUÇÃO DO ESCRITOR: ${instruction}
  
  OBJETIVO: Continue a narrativa de forma fluida.
  ESTILO: Mantenha a voz e o tom estabelecidos no conteúdo atual.
  PERSONAGENS: Respeite as motivações e personalidades conhecidas do lore.
  
  REGRAS:
  1. Comece a continuação sem repetir o que já foi escrito.
  2. Forneça entre 1 e 3 parágrafos de alta qualidade literária.
  3. Não explique o que fez, apenas retorne o texto criativo.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Error getting writing suggestion:", error);
    return "";
  }
}

export interface ImprovementSuggestion {
  id: string;
  type: 'grammar' | 'style' | 'consistency' | 'plot';
  originalText: string;
  suggestedText: string;
  explanation: string;
}

export async function analyzeManuscript(content: string, context: string, mode: 'improvements' | 'consistency' | 'show-don-t-tell', lore?: string) {
  let prompt = '';
  if (mode === 'improvements') {
    prompt = `Você é um editor literário experiente. Analise o seguinte trecho de manuscrito e sugira melhorias em termos de estilo, ritmo, gramática e clareza.
       Contexto do Projeto: ${context}
       Retorne um array JSON de objetos com: { "id": string, "type": "grammar"|"style", "originalText": string, "suggestedText": string, "explanation": string }.
       Inclua no máximo 5 sugestões críticas. Se não houver o que melhorar, retorne um array vazio.
       
       Texto: "${content}"`;
  } else if (mode === 'consistency') {
    prompt = `Você é um revisor de continuidade (continuity checker) de elite. 
       COMPÊNDIO/LORE DE REFERÊNCIA: ${lore || context}
       
       TAREFA: Verifique se há inconsistências no texto abaixo em relação ao lore estabelecido (personagens, fatos, geografia, regras de magia).
       Exemplos: Personagem que estava em um lugar aparecer em outro sem explicação, mudança súbita de poder, erro de cronologia.

       Retorne um array JSON de objetos com: { "id": string, "type": "consistency"|"plot", "originalText": string, "suggestedText": string, "explanation": string }.
       Lógica: O originalText deve ser o trecho problemático.
       
       Texto para Análise: "${content}"`;
  } else if (mode === 'show-don-t-tell') {
    prompt = `Você é um mentor de escrita criativa focado na técnica "Mostre, Não Conte" (Show, Don't Tell). 
       Analise o texto e identifique trechos onde o autor está "contando" emoções ou estados (ex: "Ele estava triste") em vez de "mostrar" através de ações, sensações ou diálogos.
       Contexto do Projeto: ${context}
       Retorne um array JSON de objetos com: { "id": string, "type": "style", "originalText": string, "suggestedText": string, "explanation": string }.
       No "suggestedText", forneça um exemplo de como mostrar aquela mesma cena.
       
       Texto: "${content}"`;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
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
            required: ["id", "type", "originalText", "suggestedText", "explanation"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]") as ImprovementSuggestion[];
  } catch (error) {
    console.error("Error analyzing manuscript:", error);
    return [];
  }
}

export async function deepCharacterDesign(name: string, storyContext: string) {
  const prompt = `Desenvolva profundamente o personagem "${name}" baseado no contexto: ${storyContext}.
  
  Crie:
  1. Descrição Visual (Visual Description)
  2. Traços de Personalidade (Personality Traits)
  3. Objetivos Principais (Main Goals)
  4. Medos e Trauma (Fears and Traumas)
  5. Tom de Voz/Estilo de Fala (Vocal Tone)
  6. Resumo Biográfico (History)

  Retorne um objeto JSON com estas chaves em português: description, traits, goals, fears, vocalTone, history.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error in deepCharacterDesign:", error);
    return null;
  }
}

export async function researchTopic(query: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Pesquise sobre o seguinte tópico para um escritor de ficção: ${query}. 
      Forneça fatos interessantes, detalhes sensoriais e informações históricas ou técnicas relevantes que possam enriquecer uma cena.
      Use uma linguagem inspiradora e organizada.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    return response.text;
  } catch (error) {
    console.error("Error researching topic:", error);
    return "Não foi possível realizar a pesquisa no momento.";
  }
}

export async function chatBotResponse(messages: { role: string, text: string }[], projectContext: string) {
  const systemInstruction = `Você é o "Scribe AI", uma inteligência de elite que atua como Diretor Criativo, Arquiteto de UX, Editor Narrativo e Lead QA.
  Sua função é co-criar e auditar o projeto do usuário com um olhar crítico e artístico.
  
  Você tem acesso ao contexto atual do projeto: ${projectContext}.
  
  DIRETRIZES DE REPOSTA:
  1. Diretor Criativo: Sugira reviravoltas, temas profundos e estética visual.
  2. Editor Narrativo: Proteja o "Canon Shield", impeça contradições e melhore o ritmo (pacing).
  3. Arquiteto de UX: Sugira como organizar as idéias para que o leitor/usuário não se perca.
  4. Lead QA: Aponte furos de roteiro, inconsistências de personagens e problemas técnicos.
  
  Não seja apenas um assistente passivo; aja como um parceiro de criação de alto nível.`;

  try {
    const formattedMessages = messages.map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: formattedMessages,
      config: {
        systemInstruction
      }
    });

    return response.text;
  } catch (error) {
    console.error("Error in chatbot response:", error);
    return "Desculpe, tive um problema ao processar sua ideia. Pode tentar novamente?";
  }
}
export async function generateAutoCharacterLore(name: string, storyContext: string) {
  const prompt = `Crie uma breve descrição (lore) e traços de personalidade para o personagem "${name}" baseado no que foi escrito até agora: ${storyContext}.
  Retorne um objeto JSON com "description" e "traits".`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            traits: { type: Type.STRING }
          },
          required: ["description", "traits"]
        }
      }
    });

    return JSON.parse(response.text || '{"description": "", "traits": ""}') as { description: string, traits: string };
  } catch (error) {
    console.error("Error generating character lore:", error);
    return { description: "", traits: "" };
  }
}
export async function processLoreDraft(draft: string) {
  const prompt = `Você é um curador de Lore de universos literários. 
  Analise o rascunho abaixo e separe-o em entradas individuais de lore. 
  Cada entrada deve ter um título, conteúdo e uma das categorias: 'world', 'lore', 'rpg', 'item', 'magic', 'faction', 'timeline' ou 'note'.
  'world' é para geografia, locais, atlas.
  'lore' é para história, mitos, cultura.
  'faction' é para grupos, organizações, facções, povoados.
  'timeline' é para sequências de eventos, cronologia, eras.
  'rpg' é para mecânicas, regras de sistema, estatísticas.
  'item' é para armas, artefatos, objetos funcionais.
  'magic' é para feitiços, magias, rituais.
  'note' é para observações soltas.
  
  Retorne um array JSON de objetos.
  
  Rascunho: "${draft}"`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              category: { type: Type.STRING, enum: ['world', 'lore', 'note', 'rpg', 'item', 'magic', 'faction', 'timeline'] }
            },
            required: ["title", "content", "category"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]") as { title: string, content: string, category: 'world' | 'lore' | 'note' }[];
  } catch (error) {
    console.error("Error processing lore draft:", error);
    return [];
  }
}

export async function architectLore(type: 'location' | 'event' | 'system' | 'atmosphere' | 'faction' | 'timeline', details: string, context: string) {
  const prompts = {
    location: `Crie um local detalhado para um universo fictício. Foco em: detalhes sensoriais, importância estratégica e segredos ocultos.`,
    event: `Crie um evento histórico ou mito para este universo. Foco em: causas, impacto no presente e como é lembrado.`,
    system: `Desenvolva um sistema (magia, economia, governo ou religião). Foco em: regras, limitações e impacto social.`,
    atmosphere: `Descreva o ambiente/clima de uma cena ou região. Foco em: imersão, sentimentos evocados e detalhes visuais.`,
    faction: `Crie uma facção, grupo ou guilda. Foco em: ideologia, hierarquia, influência no mundo e segredos.`,
    timeline: `Crie uma linha do tempo ou sequência de eventos chave. Foco em: marcos históricos, eras e transições de poder.`
  };

  const prompt = `Você é o Scribe Architect. ${prompts[type]}
  Contexto do Universo/Projeto: ${context}
  Baseado nestas ideias iniciais: "${details}"
  
  IMPORTANTE: Se o personagem, local ou conceito já existir no contexto acima, não crie um novo do zero. Em vez disso, expanda a história existente, adicione novos detalhes, segredos ou desenvolvimentos que façam sentido.
  
  Retorne um objeto JSON com: { "title": string, "content": string, "category": "world"|"lore"|"note"|"rpg"|"item"|"magic"|"faction"|"timeline" }.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "{}") as { title: string, content: string, category: 'world' | 'lore' | 'note' };
  } catch (error) {
    console.error("Error in architectLore:", error);
    return null;
  }
}

export async function getAutocomplete(context: string, textBefore: string, textAfter: string) {
  const prompt = `Você é um co-piloto de escrita criativa (Scribe AI). 
  Objetivo: Sugerir a continuação IMEDIATA da frase ou parágrafo de forma ultra-concisa e natural.
  
  CONTEXTO DO PROJETO: ${context}
  TEXTO ANTES DO CURSOR: "${textBefore}"
  TEXTO DEPOIS DO CURSOR: "${textAfter}"
  
  REGRAS:
  1. Retorne APENAS a sugestão (de 1 a 10 palavras no máximo).
  2. A sugestão deve completar o que o autor está escrevendo.
  3. Não repita o que já foi escrito.
  4. Respeite o tom e estilo do autor.
  5. Se o texto antes termina em meio a uma palavra, complete-a.
  6. Retorne string vazia se não houver uma continuação óbvia ou inspirada.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return response.text.trim().replace(/["']/g, ''); // Remove quotes if model adds them
  } catch (error) {
    console.error("Error in getAutocomplete:", error);
    return "";
  }
}

export async function getSynonyms(word: string, sentence: string, context: string) {
  const prompt = `Sugira 5 sinônimos contextuais para a palavra "${word}" na seguinte frase: "${sentence}".
  Considere o contexto literário do projeto: ${context}.
  Os sinônimos devem elevar o vocabulário e manter ou aprimorar o tom emocional.
  Retorne apenas um array JSON de strings.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    return JSON.parse(response.text || "[]") as string[];
  } catch (error) {
    console.error("Error in getSynonyms:", error);
    return [];
  }
}

export async function getPanelSuggestions(projectContext: string, currentPanels: { title: string, description?: string }[], count: number = 3) {
  const currentPanelsText = currentPanels.map(p => `[${p.title}]: ${p.description || 'Sem descrição'}`).join('\n');
  
  const prompt = `Você é um story boarder e roteirista de Mangá, HQ e Cinema de elite.
  CONTEXTO DO PROJETO: ${projectContext}
  TIPO DE PROJETO: Roteiro Cinematográfico / Storyboard Visual.
  
  PAINÉIS/CENAS ATUAIS:
  ${currentPanelsText}
  
  OBJETIVO: Sugerir ${count} próximos frames/painéis para continuar a sequência narrativa. 
  Considere o ritmo (pacing), enquadramentos cinematográficos (close-up, wide shot, bird's eye view) e a continuidade emocional.
  
  PARA CADA SUGESTÃO, FORNEÇA:
  1. Título/ID (ex: CENA 1 - SHOT 4)
  2. Descrição Visual (composição, luz, movimento de câmera)
  3. Texto/Diálogo associado
  
  Retorne um array JSON de objetos: { "title": string, "description": string }.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["title", "description"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]") as { title: string, description: string }[];
  } catch (error) {
    console.error("Error in getPanelSuggestions:", error);
    return [];
  }
}

export async function refinePanelDescription(projectContext: string, currentDescription: string, instruction: string) {
  const prompt = `Melhore ou refine a descrição visual deste painel/scene.
  CONTEXTO DO PROJETO: ${projectContext}
  DESCRIÇÃO ATUAL: "${currentDescription}"
  PEDIDO DO AUTOR: "${instruction}"
  
  Torne a linguagem mais cinematográfica, técnica e evocativa. Foque em detalhes sensoriais e enquadramento.
  Retorne apenas o texto da descrição aprimorada.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error in refinePanelDescription:", error);
    return currentDescription;
  }
}

export function getAiImageAsset(prompt: string, width: number = 1024, height: number = 1024) {
  const sanitizedPrompt = encodeURIComponent(prompt.slice(0, 200));
  return `https://image.pollinations.ai/prompt/${sanitizedPrompt}?width=${width}&height=${height}&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;
}

export async function generateStoryboardFromText(projectContext: string, manuscript: string) {
  const prompt = `Você é um story boarder e diretor cinematográfico de elite.
  CONTEXTO DO PROJETO: ${projectContext}
  MANUSCRITO:
  ${manuscript.slice(0, 8000)}
  
  OBJETIVO: Transformar este texto em um Storyboard visual (sequência lógica de painéis).
  Identifique as cenas mais impactantes e crie descrições visuais para os painéis.
  
  REGRAS:
  1. No mínimo 5 e no máximo 12 painéis.
  2. Distribua entre páginas se houver muita ação.
  3. Descreva enquadramento, ação e iluminação.
  
  Retorne um array JSON: [{ "title": string, "description": string, "pageNumber": number }].`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              pageNumber: { type: Type.NUMBER }
            },
            required: ["title", "description", "pageNumber"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]") as { title: string, description: string, pageNumber: number }[];
  } catch (error) {
    console.error("Error in generateStoryboardFromText:", error);
    return [];
  }
}

import { AuditReport } from "../types";

export async function runIntelligentAudit(
  manuscript: string, 
  loreContext: string, 
  projectMetadata: any,
  uxSnapshot?: string // Descrição opcional da UI atual
): Promise<AuditReport | null> {
  const prompt = `Você é uma ENTIDADE DE ELITE: Diretor Criativo, Arquiteto de UX e Lead QA de um sistema operacional narrativo de alta fidelidade.
  Sua missão é realizar uma AUDITORIA IMPLACÁVEL e ARTÍSTICA no projeto abaixo.

  DADOS DO PROJETO:
  Título: ${projectMetadata.title}
  Lore/Canon Base: ${loreContext}
  Manuscrito Atual (Trecho): ${manuscript.slice(-15000)}

  SUA AUDITORIA DEVE COBRIR 6 DIMENSÕES CRÍTICAS:

  1. UX/UI (O Fluxo do Criador):
     - Analise a ergonomia da narrativa. Há excesso de exposição (info-dumping)?
     - O editor está servindo ao foco do usuário? (Foque na estrutura da cena).

  2. NARRATIVA (Canon Shield):
     - DETECTE CONTRADIÇÕES: Alguma regra do universo foi quebrada?
     - Algum evento contradiz o Lore Base fornecido? Se sim, marque como CRITICAL.

  3. PERSONAGEM (Psicologia e Evolução):
     - Verifique se a voz do personagem é consistente.
     - Detecte ações que fujam da personalidade estabelecida sem justificativa emocional.

  4. VISUAL (Composição e Ritmo):
     - Avalie a densidade de painéis (se for mangá) ou a cadência de parágrafos.
     - A leitura é fluida ou exaustiva?

  5. TÉCNICA (Integridade Sistêmica):
     - Performance narrativa: capítulos muito longos ou curtos demais?
     - Furos de roteiro (plot holes) evidentes.

  6. EMOCIONAL (Emotional Flow Analysis):
     - Detecte quedas de tensão, diálogos repetitivos ou falta de "punch" emocional.
     - Identifique momentos onde o ritmo arrasta desnecessariamente.

  SAÍDA ESPERADA (JSON RIGOROSO):
  {
    "id": string (UUID),
    "overallScore": number (0-100),
    "metrics": {
      "uxEfficiency": number,
      "narrativeCohesion": number,
      "characterDepth": number,
      "visualClarity": number,
      "technicalHealth": number,
      "emotionalImpact": number
    },
    "issues": [
      {
        "id": string,
        "category": "UX"|"Narrative"|"Character"|"Visual"|"Technical"|"Emotional",
        "priority": "low"|"medium"|"high"|"critical",
        "title": string,
        "description": string,
        "suggestion": string,
        "location": string (ex: "Capítulo 5", "Painel 2", "Diálogo Inicial")
      }
    ]
  }

  REGRAS DE OURO:
  - Seja um Editor de verdade: Se o texto estiver ruim, diga. Se o nexo quebrou, bloqueie.
  - O "Canon Shield" é sua prioridade máxima.
  - Use um tom profissional, sofisticado e visionário.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const report = JSON.parse(response.text || "null");
    if (report) {
       report.timestamp = new Date();
    }
    return report;
  } catch (error) {
    console.error("Error in runIntelligentAudit:", error);
    return null;
  }
}

export async function runCinematicDirector(
  sceneDescription: string,
  projectContext: string,
  mood: string
) {
  const prompt = `Você é um Diretor de Fotografia e Storyboarder de elite especializado em Mangá e Cinema Noir/Cinematográfico.
  Sua missão é dirigir visualmente a seguinte cena.
  
  CONTEXTO DO PROJETO: ${projectContext}
  DESCRIÇÃO DA CENA: "${sceneDescription}"
  MOOD/EMOÇÃO DESEJADA: ${mood}

  REGRAS DE DIREÇÃO:
  1. Sugira o enquadramento ideal (Close-up, Extreme Wide, Dutch Angle, etc).
  2. Sugira a iluminação e contraste (Chiaroscuro, High Key, Sombra dramática).
  3. Descreva a composição do quadro (Arquitetura, profundidade de campo).
  4. Sugira o tipo de balão de fala se houver diálogo.

  Retorne um objeto JSON:
  {
    "cameraAngle": string,
    "shotType": string,
    "lighting": string,
    "composition": string,
    "emotionalNote": string,
    "balloonType": "normal"|"scream"|"thought"|"whisper"|"glitch"
  }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error in runCinematicDirector:", error);
    return null;
  }
}
