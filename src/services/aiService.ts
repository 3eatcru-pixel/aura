export interface ImprovementSuggestion {
  id: string;
  type: 'grammar' | 'style' | 'consistency' | 'plot';
  originalText: string;
  suggestedText: string;
  explanation: string;
}

async function postAi<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/ai/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `AI request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function detectCharacters(text: string, existingCharacters: string[]) {
  return postAi<string[]>('detect-characters', { text, existingCharacters });
}

export async function getWritingSuggestion(context: string, currentContent: string, instruction: string) {
  const result = await postAi<{ text: string }>('get-writing-suggestion', {
    context,
    currentContent,
    instruction,
  });
  return result.text;
}

export async function analyzeManuscript(
  content: string,
  context: string,
  mode: 'improvements' | 'consistency' | 'show-don-t-tell',
  lore?: string
) {
  return postAi<ImprovementSuggestion[]>('analyze-manuscript', {
    content,
    context,
    mode,
    lore,
  });
}

export async function deepCharacterDesign(name: string, storyContext: string) {
  return postAi<Record<string, string>>('deep-character-design', { name, storyContext });
}

export async function researchTopic(query: string) {
  const result = await postAi<{ text: string }>('research-topic', { query });
  return result.text;
}

export async function chatBotResponse(messages: { role: string; text: string }[], projectContext: string) {
  const result = await postAi<{ text: string }>('chat', { messages, projectContext });
  return result.text;
}

export async function generateAutoCharacterLore(name: string, storyContext: string) {
  return postAi<{ description: string; traits: string }>('generate-auto-character-lore', {
    name,
    storyContext,
  });
}

export async function processLoreDraft(draft: string) {
  return postAi<Array<{ title: string; content: string; category: string }>>('process-lore-draft', {
    draft,
  });
}

export async function architectLore(
  type: 'location' | 'event' | 'system' | 'atmosphere' | 'faction' | 'timeline',
  details: string,
  context: string
) {
  return postAi<{ title: string; content: string; category: string }>('architect-lore', {
    type,
    details,
    context,
  });
}

export async function getAutocomplete(context: string, textBefore: string, textAfter: string) {
  const result = await postAi<{ text: string }>('get-autocomplete', { context, textBefore, textAfter });
  return result.text;
}

export async function getSynonyms(word: string, sentence: string, context: string) {
  return postAi<string[]>('get-synonyms', {
    word,
    sentence,
    context,
  });
}

export async function getPanelSuggestions(
  projectContext: string,
  currentPanels: { title: string; description?: string }[],
  count: number = 3
) {
  return postAi<Array<{ title: string; description: string }>>('get-panel-suggestions', {
    projectContext,
    currentPanels,
    count,
  });
}

export async function refinePanelDescription(projectContext: string, currentDescription: string, instruction: string) {
  const result = await postAi<{ text: string }>('refine-panel-description', {
    projectContext,
    currentDescription,
    instruction,
  });
  return result.text;
}

export async function generateStoryboardFromText(projectContext: string, manuscript: string) {
  return postAi<Array<{ title: string; description: string; pageNumber: number }>>(
    'generate-storyboard-from-text',
    { projectContext, manuscript }
  );
}

export async function runIntelligentAudit(
  manuscript: string,
  loreContext: string,
  projectMetadata: any
) {
  return postAi<any>('run-intelligent-audit', { manuscript, loreContext, projectMetadata });
}

export async function runCinematicDirector(
  sceneDescription: string,
  projectContext: string,
  mood: string
) {
  return postAi<any>('run-cinematic-director', { sceneDescription, projectContext, mood });
}

export function getAiImageAsset(prompt: string, width: number = 1024, height: number = 1024) {
  const sanitizedPrompt = encodeURIComponent(prompt.slice(0, 200));
  return `https://image.pollinations.ai/prompt/${sanitizedPrompt}?width=${width}&height=${height}&seed=${Math.floor(
    Math.random() * 1000000
  )}&nologo=true`;
}
