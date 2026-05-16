import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify: file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('/@firebase/')) return 'firebase-core';
            if (id.includes('/firebase/')) return 'firebase';
            if (id.includes('/googleapis/') || id.includes('/gaxios/') || id.includes('/google-auth-library/')) return 'googleapis';
            if (id.includes('/@google/genai/') || id.includes('/@ai-sdk/') || id.includes('/ai/')) return 'ai-stack';
            if (id.includes('/fabric/')) return 'fabric';
            if (id.includes('/motion/') || id.includes('/framer-motion/')) return 'motion';
            if (id.includes('/lucide-react/')) return 'icons';
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-core';
            return 'vendor';
          },
        },
      },
    },
  };
});
