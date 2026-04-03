import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// @rule:ANKR-001 — vite.config
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
