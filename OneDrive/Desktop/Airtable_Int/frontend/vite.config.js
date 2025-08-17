import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  server: {
    port: 5173, // This sets the frontend port to 5173
    proxy: {
      // Proxy requests from /api to your backend
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Proxy requests from /auth to your backend
      '/auth': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  }
})