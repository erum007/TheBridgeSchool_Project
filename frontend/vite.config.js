import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isMobile = mode === 'mobile'

  return {
    plugins: [
      react(),
      tailwindcss(),
      isMobile && {
        name: 'cordova-runtime',
        transformIndexHtml: {
          order: 'pre',
          handler: () => [{ tag: 'script', attrs: { src: 'cordova.js' }, injectTo: 'body' }],
        },
      },
    ].filter(Boolean),
    // Web routes are served by Vercel's SPA fallback, so assets must resolve
    // from the deployment root when a nested route is refreshed. Cordova still
    // needs relative paths because it loads the bundle from the device filesystem.
    base: isMobile ? './' : '/',
    build: isMobile
      ? {
          outDir: '../mobile/www',
          emptyOutDir: true,
        }
      : undefined,
  }
})
