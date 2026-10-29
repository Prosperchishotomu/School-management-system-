import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_BACKEND_TARGET || 'https://school-management-system-x05j.onrender.com/api/v1'
  const host = env.VITE_HOST || '0.0.0.0'
  const port = Number(env.VITE_PORT || 5173)
  const previewPort = Number(env.VITE_PREVIEW_PORT || 4173)
  const hmrHost = env.VITE_HMR_HOST || 'localhost'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      host,
      port,
      strictPort: false,
      hmr: {
        host: hmrHost,
        port,
      },
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/backend': {
          target: backendTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/backend/, ''),
        },
      },
    },
    preview: {
      host,
      port: previewPort,
      strictPort: false,
    },
  }
})
