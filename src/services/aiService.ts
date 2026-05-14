// aura/src/services/aiService.ts
import { AuditReport } from "../types";

// Helper para limpar e parsear JSON de qualquer modelo (remove blocos Markdown)
function parseAiResponse(text: string) {
  try {
    // Remove blocos de código markdown se presentes (```json ... ``` ou ``` ...)
    const cleanText = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Falha crítica ao parsear resposta da IA. Texto bruto:", text);
    return null;
  }
}

// Helper para obter o provedor preferido do usuário
function getAiProvider(): 'gemini' | 'gpt' | 'deepseek' {
  return (localStorage.getItem('aura_ai_provider') as any) || 'gemini';
}

// Helper genérico para chamar o proxy do servidor para modelos de IA (Gemini, GPT, DeepSeek)
async function callAiProxy(model: 'gemini' | 'gpt' | 'deepseek', payload: any): Promise<{ text: string }> {
  const endpoints = {
    gemini: '/api/ai/gemini-proxy',
    gpt: '/api/ai/gpt-proxy',
    deepseek: '/api/ai/deepseek-proxy'
  };
  
  // Recupera chaves privadas do usuário salvas localmente
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (localStorage.getItem('aura_openai_key')) headers['x-user-openai-key'] = localStorage.getItem('aura_openai_key')!;
  if (localStorage.getItem('aura_deepseek_key')) headers['x-user-deepseek-key'] = localStorage.getItem('aura_deepseek_key')!;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || `Erro no Assistente (${model})`);
  }
  
  return await response.json();
}

// Helper genérico para chamar o proxy do servidor para tradução (DeepL)
async function callTranslationProxy(payload: any): Promise<{ translatedText: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (localStorage.getItem('aura_deepl_key')) headers['x-user-deepl-key'] = localStorage.getItem('aura_deepl_key')!;

  const response = await fetch('/api/translate/deepl-proxy', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Erro no Tradutor (DeepL)');
  }
  
  return await response.json();
}

export async function detectCharacters(text: string, existingCharacters: string[]) {
  const prompt = `Analise o seguinte trecho de história e identifique nomes de personagens que aparecem. 
  Considere apenas personagens novos, ignorando os seguintes que já conhecemos: ${existingCharacters.join(', ')}.
  Retorne apenas um array JSON de strings com os nomes.
  
  Texto: "${text}"`;

  try {
    const provider = getAiProvider();
    const data = await callAiProxy(provider, { prompt, messages: [{ role: 'user', content: prompt }] });
    return parseAiResponse(data.text) || [];
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
    const provider = getAiProvider();
    let data;
    if (provider === 'gemini') {
      data = await callAiProxy('gemini', { prompt, model: "gemini-2.0-flash" });
    } else {
      data = await callAiProxy(provider, { 
        messages: [{ role: 'user', content: prompt }] 
      });
    }
    return data.text;
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
    const provider = getAiProvider();
    let data;
    if (provider === 'gemini') {
      data = await callAiProxy('gemini', { 
        prompt,
        model: "gemini-2.0-flash",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string" },
                originalText: { type: "string" },
                suggestedText: { type: "string" },
                explanation: { type: "string" }
              },
              required: ["id", "type", "originalText", "suggestedText", "explanation"]
            }
          }
        }
      });
    } else {
      // Para OpenAI/DeepSeek, confiamos no prompt e no parseAiResponse
      data = await callAiProxy(provider, { messages: [{ role: 'user', content: prompt }] });
    }

    return parseAiResponse(data.text) || [];
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
    const provider = getAiProvider();
    let data;
    if (provider === 'gemini') {
      data = await callAiProxy('gemini', { prompt, model: "gemini-2.0-flash", config: { responseMimeType: "application/json" } });
    } else {
      data = await callAiProxy(provider, { messages: [{ role: 'user', content: prompt }] });
    }
    return parseAiResponse(data.text) || {};
  } catch (error) {
    console.error("Error in deepCharacterDesign:", error);
    return null;
  }
}

export async function researchTopic(query: string) {
  try {
    const data = await callAiProxy('gemini', { 
      prompt: `Pesquise sobre o seguinte tópico para um escritor de ficção: ${query}. 
      Forneça fatos interessantes, detalhes sensoriais e informações históricas ou técnicas relevantes que possam enriquecer uma cena.
      Use uma linguagem inspiradora e organizada.`,
      model: "gemini-2.0-flash",
      config: {
        tools: [{ googleSearch: {} }] // Gemini-specific tool
      }
    });
    return data.text;
  } catch (error) {
    console.error("Error researching topic:", error);
    return "Não foi possível realizar a pesquisa no momento.";
  }
}

export async function chatBotResponse(
  messages: { role: string, text: string }[], 
  projectContext: string,
  provider: 'gemini' | 'gpt' | 'deepseek' = (localStorage.getItem('aura_ai_provider') as any) || 'gemini'
) {
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
    let data;
    if (provider === 'gemini') {
      const formattedMessages = messages.map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }]
      }));
      data = await callAiProxy('gemini', { 
        contents: formattedMessages,
        model: "gemini-2.0-flash",
        systemInstruction: { parts: [{ text: systemInstruction }] }
      });
    } else {
      // Provedores OpenAI-Compatible (GPT e DeepSeek)
      const formattedMessages = messages.map(m => ({ 
        role: m.role === "user" ? "user" : "assistant", 
        content: m.text 
      }));
      data = await callAiProxy(provider, { 
        messages: formattedMessages,
        systemInstruction: systemInstruction 
      });
    }
    return data.text;
  } catch (error) {
    console.error("Error in chatbot response:", error);
    return "Desculpe, tive um problema ao processar sua ideia. Pode tentar novamente?";
  }
}
export async function generateAutoCharacterLore(name: string, storyContext: string) {
  const prompt = `Crie uma breve descrição (lore) e traços de personalidade para o personagem "${name}" baseado no que foi escrito até agora: ${storyContext}.
  Retorne um objeto JSON com "description" e "traits".`;

  try {
    const data = await callAiProxy('gemini', { 
      prompt,
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            description: { type: "string" },
            traits: { type: "string" }
          },
          required: ["description", "traits"]
        }
      }
    });
    return parseAiResponse(data.text) || { description: "", traits: "" };
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
    const data = await callAiProxy('gemini', { 
      prompt,
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              content: { type: "string" },
              category: { type: "string", enum: ['world', 'lore', 'note', 'rpg', 'item', 'magic', 'faction', 'timeline'] }
            },
            required: ["title", "content", "category"]
          }
        }
      }
    });
    return parseAiResponse(data.text) || [];
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
    const data = await callAiProxy('gemini', { 
      prompt,
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json"
      }
    });
    return parseAiResponse(data.text) || {};
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
    const data = await callAiProxy('gemini', { 
      prompt,
      model: "gemini-2.0-flash"
    });
    return data.text.trim().replace(/["']/g, ''); // Remove quotes if model adds them
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
    const data = await callAiProxy('gemini', { 
      prompt,
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: { type: "string" }
        }
      }
    });
    return parseAiResponse(data.text) || [];
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
    const data = await callAiProxy('gemini', { 
      prompt,
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" }
            },
            required: ["title", "description"]
          }
        }
      }
    });
    return parseAiResponse(data.text) || [];
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
    const data = await callAiProxy('gemini', { 
      prompt,
      model: "gemini-2.0-flash"
    });
    return data.text.trim();
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
    const data = await callAiProxy('gemini', { 
      prompt,
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              pageNumber: { type: "number" }
            },
            required: ["title", "description", "pageNumber"]
          }
        }
      }
    });
    return parseAiResponse(data.text) || [];
  } catch (error) {
    console.error("Error in generateStoryboardFromText:", error);
    return [];
  }
}

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
        "location": string (ex: "Página 5", "Painel 2", "Diálogo Inicial")
      }
    ]
  }

  REGRAS DE OURO:
  - Seja um Editor de verdade: Se o texto estiver ruim, diga. Se o nexo quebrou, bloqueie.
  - O "Canon Shield" é sua prioridade máxima.
  - Use um tom profissional, sofisticado e visionário.`;

  try {
    const data = await callAiProxy('gemini', { 
      prompt,
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json"
      }
    });
    const report = parseAiResponse(data.text);
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
    const data = await callAiProxy('gemini', { 
      prompt,
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json"
      }
    });
    return parseAiResponse(data.text) || {};
  } catch (error) {
    console.error("Error in runCinematicDirector:", error);
    return null;
  }
}

export async function improveWriting(
  text: string, 
  context: string, 
  tone: string, 
  rhythm: string, 
  emotion: string
) {
  const prompt = `Você é um Editor Literário de elite e Especialista em Estilo. 
  Sua missão é REESCREVER e MELHORAR o texto abaixo seguindo as diretrizes de Estética Editorial solicitadas.

  TEXTO ATUAL: "${text}"
  
  CONTEXTO DO PROJETO: ${context}
  TOM DESEJADO: ${tone}
  RITMO (PACING): ${rhythm}
  EMOÇÃO DOMINANTE: ${emotion}

  DIRETRIZES DE REESCRITA:
  1. Eleve a qualidade literária (vocabulário rico, figuras de linguagem).
  2. Ajuste o ritmo: Frases curtas e diretas para ritmo acelerado, descrições ricas e frases longas para ritmo lento.
  3. Intensifique a emoção e o tom solicitados.
  4. Mantenha a essência e os fatos da cena original.
  5. Remova clichês e redundâncias.

  Retorne apenas o texto reescrito, sem explicações.`;

  try {
    const data = await callAiProxy('gemini', { 
      prompt,
      model: "gemini-2.0-flash"
    });
    return data.text.trim();
  } catch (error) {
    console.error("Error in improveWriting:", error);
    return text;
  }
}

// --- New Translation Service ---
export async function translateText(text: string, targetLang: string, sourceLang?: string) {
  try {
    const data = await callTranslationProxy({ 
      text, 
      target_lang: targetLang, 
      source_lang: sourceLang 
    });
    return data.translatedText;
  } catch (error) {
    console.error("Error translating text:", error);
    return "";
  }
}
