# AURA • Sovereign Narrative OS

AURA é um Sistema Operacional Narrativo de alta fidelidade projetado para escritores, roteiristas e arquitetos de mundos. Construído com uma filosofia **Client-Side First**, ele permite que usuários criem obras complexas com custo operacional zero para o provedor.

## 🚀 Arquitetura de Custo Zero (BYOK)

O projeto utiliza o modelo **Bring Your Own Key**:
- **IA Principal:** Google Gemini (autenticado via OAuth do próprio usuário).
- **IA Adicional:** GPT-4o, DeepSeek e DeepL (chaves API providas pelo usuário e salvas localmente).
- **Storage:** Google Drive pessoal do usuário para backups e sincronização.
- **Database:** Firebase Spark (Metadados e configurações).

## 🛠 Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Estilização:** Tailwind CSS + Framer Motion (Animações editoriais)
- **Backend:** Express (Serverless Ready para Vercel)
- **Canvas:** Fabric.js (Direção Cinematográfica)
- **Auth/DB:** Firebase (Spark Plan)

## 📦 Instalação e Desenvolvimento

1. Clone o repositório:
   ```bash
   git clone [url-do-repo]
   cd aura
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente (`.env`):
   ```env
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   APP_URL=http://localhost:3000
   # Firebase Config (Vite)
   VITE_FIREBASE_API_KEY=...
   ```

4. Inicie o ambiente de desenvolvimento:
   ```bash
   npm run dev
   ```

## ☁️ Deploy (Vercel)

O projeto está configurado para deploy imediato na Vercel através do arquivo `vercel.json`. As rotas de API em `server.ts` são tratadas como Node.js Serverless Functions.

---
 desenvolvido por **3eat Cru**