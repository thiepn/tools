import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Tiny Tools is a GitHub Pages project site and is published at /tools/.
  // Keep generated entry, lazy-chunk, worker, WASM, CSS, and asset URLs pinned
  // to that repository path rather than depending on the current document URL.
  base: '/tools/',
  plugins: [react(), tailwindcss()],
  build: {
    // The production verifier uses Vite's manifest to prove that every emitted
    // dynamic entry and its transitive assets exist before deployment.
    manifest: true,
  },
});
