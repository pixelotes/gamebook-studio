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
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'build',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});