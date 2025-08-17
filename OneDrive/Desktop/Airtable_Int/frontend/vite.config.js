import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  server: {
    port: 5173,
    // This proxy is essential for your app to work
    proxy: {
      // Forward requests for /api/... to your backend
      '/api': {
        target: 'https://airtable-integration.onrender.com', // Make sure this port matches your backend
        changeOrigin: true,
      },
      // Forward requests for /auth/... to your backend
      '/auth': {
        target: 'https://airtable-integration.onrender.com',
        changeOrigin: true,
      }
    }
  }
})