import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API routes to Express server (run "npm run server" in another terminal for full dev)
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/billing': { target: 'http://localhost:3000', changeOrigin: true },
      '/organizations': { target: 'http://localhost:3000', changeOrigin: true },
      '/enterprises': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
