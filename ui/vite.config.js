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
  },
});
