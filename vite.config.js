import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 8518: puerto propio del proyecto, para no chocar con otros servidores
  // locales. Si está ocupado, Vite toma el siguiente libre.
  server: { port: 8518 },
  preview: { port: 8518 },
})
