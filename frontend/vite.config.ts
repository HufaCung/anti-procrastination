/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.TINYDO_API_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: process.env.TINYDO_API_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
