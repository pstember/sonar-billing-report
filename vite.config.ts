import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/recharts')) return 'recharts';
          if (id.includes('node_modules/ag-grid')) return 'ag-grid';
          if (id.includes('node_modules/xlsx')) return 'xlsx';
          if (id.includes('node_modules/jspdf')) return 'jspdf';
        },
      },
    },
  },
  server: {
    port: 5173,
    // Proxy API routes to Express server (run "npm run server" in another terminal for full dev)
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/billing': { target: 'http://localhost:3000', changeOrigin: true },
      '/organizations': { target: 'http://localhost:3000', changeOrigin: true },
      '/enterprises': { target: 'http://localhost:3000', changeOrigin: true },
      '/config': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
