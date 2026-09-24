import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api_comprasnet': {
        target: 'https://contratos.comprasnet.gov.br',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api_comprasnet/, ''),
      },
    },
  },
})
