import { defineConfig } from 'vitest/config';
// Código en app/. En desarrollo se sirven todas las páginas; para publicar, cada página se compila
// sola (PAGE=juego) en un único JS, y scripts/standalone.py la deja autónoma en la raíz.
const PAGES: Record<string, string> = { juego: 'app/juego.html' };
const page = process.env.PAGE;
export default defineConfig({
  root: 'app',
  base: './',
  publicDir: '../assets-public',
  build: {
    outDir: page ? `../dist/${page}` : '../dist',
    emptyOutDir: true,
    rollupOptions: { input: page ? { [page]: PAGES[page] } : PAGES },
  },
  server: { fs: { allow: ['..'] } },
  test: { root: '.', include: ['tests/**/*.test.ts'] },
});
