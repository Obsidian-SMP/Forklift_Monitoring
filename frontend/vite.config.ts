// ==============================================================================
// File: vite.config.ts
// Description: Vite Bundler Configuration for Revised Warehouse Dashboard.
// Purpose: Configures React fast-refresh plugin, local development server port,
//          and API proxy forwarding requests to the Flask backend (Port 5000).
// ==============================================================================

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
      },
    },
  },
});
