import { defineConfig } from 'vite';

// Static single-page game. base:'./' keeps asset URLs relative so the
// production build can be served from any sub-path.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  server: {
    open: true,
  },
});
