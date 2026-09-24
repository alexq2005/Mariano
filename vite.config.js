import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dónde vive el sitio. En Vercel o en un dominio propio, en la raíz ("/").
// En GitHub Pages, en /<nombre-del-repo>/: lo pasa el workflow
// (.github/workflows/pages.yml) con BASE_PATH. Las fotos, el catálogo y el
// router ya usan import.meta.env.BASE_URL, así que funciona en los dos.
const base = process.env.BASE_PATH || '/'

// La vista previa del link (index.html) necesita la dirección COMPLETA de la
// imagen: WhatsApp no entiende "/og.jpg". Se sabe recién al publicar, y el
// workflow la pasa en SITE_URL (en Vercel sale de su propia variable). Sin
// ninguna, queda relativa a la base: el sitio anda igual, solo que el link
// compartido sale sin foto.
const urlSitio =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/` : base)

const completarUrlSitio = () => ({
  name: 'completar-url-sitio',
  transformIndexHtml: (html) => html.replaceAll('__URL_SITIO__', urlSitio),
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), completarUrlSitio()],
  base,
  // 8518: puerto propio del proyecto, para no chocar con otros servidores
  // locales. Si está ocupado, Vite toma el siguiente libre.
  server: { port: 8518 },
  preview: { port: 8518 },
})
