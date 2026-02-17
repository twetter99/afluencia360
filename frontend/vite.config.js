import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['lucide-react', 'react-dropzone'],
          recharts: ['recharts', 'recharts-scale'],
          'd3-vendor': [
            'd3-array',
            'd3-ease',
            'd3-interpolate',
            'd3-scale',
            'd3-shape',
            'd3-time',
            'd3-timer'
          ],
          vendor: ['axios']
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
