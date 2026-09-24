import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dónde vive el sitio. En Vercel o en un dominio propio, en la raíz ("/").
  // En GitHub Pages, en /<nombre-del-repo>/: lo pasa el workflow
  // (.github/workflows/pages.yml) con BASE_PATH. Las fotos, el catálogo y
  // el router ya usan import.meta.env.BASE_URL, así que funciona en los dos.
  base: process.env.BASE_PATH || '/',
  // 8518: puerto propio del proyecto, para no chocar con otros servidores
  // locales. Si está ocupado, Vite toma el siguiente libre.
  server: { port: 8518 },
  preview: { port: 8518 },
})
