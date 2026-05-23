import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Exclude the Emscripten glue file from Vite's pre-bundling pass.
  // It lives in public/ and is loaded at runtime via a dynamic <script> tag.
  optimizeDeps: {
    exclude: [],
  },
  server: {
    port: 5173,
    // Serve public/wasm/ with correct MIME type for .wasm files
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    // Proxy /api/* to the Vercel dev server so serverless functions work
    // during local development. Run `vercel dev` (port 3000) alongside
    // `npm run dev` (port 5173) to use this.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
