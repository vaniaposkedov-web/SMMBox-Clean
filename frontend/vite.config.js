import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: [
      'felicia-semivulcanized-leatha.ngrok-free.dev' // Разрешаем Ngrok стучаться к нам
    ]
  }
})