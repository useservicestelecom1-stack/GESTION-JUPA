
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carga las variables de entorno del sistema (Vercel) y archivos .env
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            icons: ['lucide-react']
          }
        }
      }
    },
    define: {
      // Esto permite que el código 'process.env.API_KEY' funcione en el navegador
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY || '')
    }
  };
});
