import { defineConfig } from 'vite';

// Card art lives in assets/ and is served from the site root (assets/ww2/<id>.webp -> ./ww2/<id>.webp).
export default defineConfig({
  base: './',
  publicDir: 'assets',
  build: { outDir: 'dist', target: 'es2022' },
});
