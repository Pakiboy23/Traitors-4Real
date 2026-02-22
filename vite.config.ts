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
      optimizeDeps: {
        // The repo contains a local PocketBase binary named `pocketbase`.
        // Excluding the npm `pocketbase` package from esbuild prebundle avoids
        // a name-collision resolution bug during `vite dev`.
        exclude: ['pocketbase'],
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
