import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: [
      ".serveousercontent.com",
      ".serveo.net",
      ".bore.pub",
      ".loca.lt",
      ".ngrok.io",
      ".ngrok-free.app"
    ],
    hmr: false, // Disabled for stability across local/tunneled environments
  },
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-core': ['react', 'react-dom', 'react-router-dom'],
          'tiptap': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder', '@tiptap/extension-typography', '@tiptap/extension-task-list', '@tiptap/extension-task-item', '@tiptap/extension-code-block-lowlight', 'tiptap-markdown'],
          'markdown': ['react-markdown', 'remark-gfm'],
          'syntax': ['lowlight'],
          'ui': ['lucide-react', 'zustand', 'clsx', 'tailwind-merge', 'suncalc', 'idb']
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
})
