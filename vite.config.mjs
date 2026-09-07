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
          if (!id.includes('node_modules')) return;
          const pkg = id.split('node_modules/').pop().split('/')[0];
          if (pkg === 'pdfjs-dist') return 'pdfjs';
          if (['konva', 'react-konva', 'its-fine', 'use-image'].includes(pkg)) return 'konva';
          if (['react', 'react-dom', 'scheduler'].includes(pkg)) return 'react';
          if (['socket.io-client', 'engine.io-client', '@socket.io', 'pako', 'jsondiffpatch', 'crc'].includes(pkg)) return 'sync';
          // jszip is imported dynamically, so it gets its own on-demand chunk.
          // (Do not pull its 'buffer' dependency in here: 'crc' also needs it, which would force an eager import.)
          if (pkg === 'jszip') return 'jszip';
          return 'vendor';
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