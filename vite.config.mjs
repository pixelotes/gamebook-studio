import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'; // <-- Import the new plugin

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // <-- Add the plugin here
  ],
  define: {
    'process.env': {}
  },
  server: {
    host: true,
    port: 3000,
  },
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist')) return 'pdfjs';
          if (id.includes('node_modules')) return 'vendor';
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
  },
});