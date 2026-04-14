import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const buildHash = Date.now().toString(36);

export default defineConfig({
  define: {
    __BUILD_HASH__: JSON.stringify(buildHash),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'inject-build-hash',
      transformIndexHtml(html) {
        return html.replace('__BUILD_HASH_PLACEHOLDER__', buildHash);
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        // Point to your local wrangler dev server, or your deployed Worker URL
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
