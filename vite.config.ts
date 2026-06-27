import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// ponytail: single app, no SSR. Tauri uses ../dist as frontendDist.
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { target: 'esnext' },
});