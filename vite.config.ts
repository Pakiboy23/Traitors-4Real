import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      preview: {
        port: 8080,
        host: '0.0.0.0',
        allowedHosts: [
          'traitorsfantasydraft-web.fly.dev',
          'traitorsfantasydraft.online',
          'www.traitorsfantasydraft.online',
        ],
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
