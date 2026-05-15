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
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});