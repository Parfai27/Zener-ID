import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const dir = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// The frontend runs entirely on mock data for now (src/api/mock.ts).
// When the backend is wired in, `server.proxy` will forward /v1 to FastAPI.
export default defineConfig({
  // Tailwind powers the landing, sign-in and register pages (src/landing).
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // The landing code (ported from the Next.js `landing` repo) imports with "@/".
      '@': dir('./src/landing'),
      'next/link': dir('./src/landing/shims/next-link.tsx'),
    },
  },
  server: { port: 5173 },
})
