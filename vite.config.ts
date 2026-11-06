import { defineConfig } from 'vite';

// Tauri expects a fixed dev-server port and shouldn't have its Rust files watched.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: { main: 'index.html', kleerkast: 'kleerkast.html' },
    },
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
