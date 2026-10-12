import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { plugins: [react()], build: { rollupOptions: { output: { manualChunks: {
    charts: ['recharts'], maps: ['leaflet'], qr: ['qrcode'],
  } } } }, server: { port: 5173, strictPort: true, proxy: {
    '/api': { target: env.API_GATEWAY_URL || 'http://127.0.0.1:8000', changeOrigin: true },
  } } };
});
