import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative assets keep the static build portable on GitHub Pages repository subpaths.
  base: './',
  plugins: [react(), tailwindcss()],
});
