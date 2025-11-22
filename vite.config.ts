import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // GitHub Pages base path
  // If deploying to https://<username>.github.io/e2b-mcp-api/
  base: process.env.NODE_ENV === 'production' ? '/' : '/',
})
