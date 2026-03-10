import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Ensure Authorization header is forwarded (some setups strip it)
            const auth = (req.headers as Record<string, string | string[] | undefined>)['authorization'];
            if (auth) proxyReq.setHeader('Authorization', auth);
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
