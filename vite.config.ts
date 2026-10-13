import { defineConfig } from 'vite';
export default defineConfig({
  server: { proxy: { '/api': 'http://127.0.0.1:3000', '/uploads': 'http://127.0.0.1:3000' } },
  build: { outDir: 'dist', rollupOptions: { input: ['index.html', 'verify-email.html'] } },
});
