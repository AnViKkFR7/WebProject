import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Los tests del snippet de las webs de cliente (company-site-snippet) se
    // ejecutan aquí: es donde están vitest y el resto de herramientas.
    include: ['src/**/*.test.{js,jsx,ts}', 'tests/**/*.test.js', '../company-site-snippet/**/*.test.ts'],
  },
})
