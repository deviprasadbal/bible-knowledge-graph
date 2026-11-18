import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base + hash routing lets the built site run from any sub-path (e.g. GitHub Pages /repo/).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
  },
});
