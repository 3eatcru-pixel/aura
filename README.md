<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Lumen Scribe

Editor criativo de mundos, personagens e narrativas com integração Firebase, Google Drive e assistentes de escrita AI.

## Visão Geral

Este projeto é uma aplicação React + Vite com backend Express para suporte a autenticação Google Drive e sincronização de backup. Ele oferece:

- login com Google via Firebase Auth
- gerenciamento de projetos literários e universos
- capítulos, personagens, lore, versões e chat AI
- persistência em Firestore
- integração de backup no Google Drive
- geração de texto e análises via Google Gemini (GenAI)

## Estrutura principal

- `src/App.tsx` — gerencia autenticação, seleção de projeto e navegação entre views
- `src/components/` — UI e editor de projeto, chat, gerente de lore, painel de análise, etc.
- `src/services/aiService.ts` — camada de serviço que chama rotas backend `/api/ai/*`
- `src/lib/firebase.ts` — inicialização do Firebase
- `server.ts` — servidor Express + middleware Vite + rotas de Google Drive e IA segura

## Como executar

1. Instale dependências:
   `npm install`

2. Crie um arquivo `.env` na raiz com:
   ```env
   GEMINI_API_KEY=seu_api_key_gemini
   GOOGLE_CLIENT_ID=seu_client_id
   GOOGLE_CLIENT_SECRET=seu_client_secret
   APP_URL=http://localhost:3000
   ```

3. Rode em modo de desenvolvimento:
   `npm run dev`

4. Abra no navegador:
   `http://localhost:3000`

## Scripts úteis

- `npm run dev` — inicia Express + Vite em modo dev
- `npm run build` — compila o frontend com Vite
- `npm run preview` — executa a pré-visualização do build
- `npm run lint` — checa TypeScript sem emitir arquivos

## Dependências importantes

- `react 19`
- `vite 6`
- `firebase 12`
- `express 4`
- `@google/genai` (GenAI)
- `googleapis` (Drive OAuth)
- `lucide-react`, `tailwindcss`, `motion`

## Auditoria de lógica e problemas detectados

### 1. Uso de API de IA no backend

O arquivo `src/services/aiService.ts` agora encaminha chamadas para rotas backend seguras (`/api/ai/*`). O backend em `server.ts` usa `@google/genai` com `process.env.GEMINI_API_KEY`, mantendo a chave de API fora do pacote client-side.

- `src/services/aiService.ts` faz `fetch('/api/ai/...')`
- `server.ts` processa as solicitações e chama o Gemini somente no servidor
- a chave permanece protegida em `.env` e não é exposta ao navegador

### 2. Formato de mensagens do chat AI

Em `src/components/AIChat.tsx`, a função `chatBotResponse(...)` formata `messages` usando `role: 'user'` ou `role: 'model'`. Isso pode estar incorreto dependendo da API do Gemini para histórico de conversas.

### 3. Salvamento assíncrono não aguardado

Em `src/components/ProjectEditor.tsx`, funções como `handleChapterSwitch` e `handleTabChange` chamam `handleSave()` sem `await`. Isso pode causar:

- perda de texto se o usuário mudar de capítulo rápido
- conflitos de escrita em capítulos diferentes

### 4. Criação de capítulo automática

`ProjectEditor` tenta criar um capítulo automaticamente quando a coleção está vazia. Isso é conveniente, mas deve ser trabalhado com cuidado para não criar capítulos duplicados em cenários offline/cache.

### 5. Uso compartilhado de estado no Dashboard

`src/components/Dashboard.tsx` compartilha `newTitle` entre a criação de projeto e criação de universo. Isso pode causar comportamento inesperado se o usuário alternar entre esses dois formulários sem limpar o campo corretamente.

### 6. Sincronização do Google Drive

O `server.ts` cria pastas e arquivos no Drive sempre que `POST /api/sync/drive` é chamado. Ele não faz checagem de existência segura por projeto, o que pode gerar duplicações ao sincronizar repetidamente.

### 7. Rota de backend com variáveis de ambiente

O servidor Express depende de:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `APP_URL`

Sem esses valores, o fluxo de OAuth não funciona.

## O que validar primeiro

1. Verificar se `src/services/aiService.ts` encaminha corretamente para o backend (`/api/ai/*`).
2. Testar os endpoints IA no backend e garantir que `server.ts` usa a chave `GEMINI_API_KEY` apenas no servidor.
3. Ajustar o salvamento em `ProjectEditor` para aguardar `handleSave()` antes de trocar capítulo/tab.
4. Testar `npm run dev` e as rotas `/api/auth/google/url`, `/api/auth/google/status`, `/api/sync/drive`.

## Próximos passos recomendados

- mover a lógica de IA para uma camada de API server-side
- revisar e normalizar a forma como o Firestore recebe `collection(...)` e `doc(...)`
- adicionar tratamento de erro visível ao usuário para falhas em `chat`, `save`, `create` e `sync`
- adicionar testes básicos de fluxo de edição e login

---

> Observação: este README foi atualizado para registrar o estado atual do app, as dependências e os principais pontos de auditoria de lógica detectados no código.
