import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const dir = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Sign-in, registration and password reset call the backend (src/api/auth.ts);
// the rest still runs on the in-browser mock (src/api/mock.ts). In development
// /v1 is forwarded to FastAPI, so the browser talks to one origin.
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
  server: {
    port: 5173,
    // BACKEND_URL overrides where the API runs (default: uvicorn on port 8000).
    proxy: { '/v1': { target: process.env.BACKEND_URL || 'http://localhost:8000', changeOrigin: true } },
  },
})
