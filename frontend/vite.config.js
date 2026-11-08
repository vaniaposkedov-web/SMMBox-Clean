import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react';
          // Значки одним файлом: иначе сборка делает десятки крошечных файлов, и каждый это отдельный запрос по медленной сети.
          if (/node_modules\/lucide-react\//.test(id)) return 'icons';
        },
      },
    },
  },
})