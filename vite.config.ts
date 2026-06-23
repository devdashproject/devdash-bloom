import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5184,
    proxy: {
      '/api': {
        target: 'https://dev-dash-server-production.up.railway.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
