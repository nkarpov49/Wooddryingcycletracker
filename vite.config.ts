import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',  // явно говорим: выводи в dist
  },
  base: '/',  // важно для Vercel, чтобы пути были правильными
})
