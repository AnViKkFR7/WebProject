import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const deploymentEnv = env.VITE_DEPLOYMENT_ENV || process.env.VERCEL_ENV || (mode === 'development' ? 'local' : mode)
  const appVersion = env.VITE_APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || (mode === 'development' ? 'local' : 'unversioned')

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_DEPLOYMENT_ENV': JSON.stringify(deploymentEnv),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    },
    test: {
      // Los tests del snippet de las webs de cliente (company-site-snippet) se
      // ejecutan aquí: es donde están vitest y el resto de herramientas.
      include: ['src/**/*.test.{js,jsx,ts}', 'tests/**/*.test.{js,ts}', '../company-site-snippet/**/*.test.ts'],
    },
  }
})
