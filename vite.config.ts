import { defineConfig } from 'vite';

// Card art lives in assets/ and is served from the site root (assets/ww2/<id>.webp -> ./ww2/<id>.webp).
// In development the game server (npm run dev:server, port 3000) answers /api and /ws.
export default defineConfig({
  base: './',
  publicDir: 'assets',
  build: { outDir: 'dist', target: 'es2022' },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/ws': { target: 'ws://127.0.0.1:3000', ws: true },
    },
  },
});
