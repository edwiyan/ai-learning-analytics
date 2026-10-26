/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = process.env.BACKEND_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
  server: {
    proxy: {
      '/auth':        BACKEND,
      '/users':       BACKEND,
      '/courses':     BACKEND,
      '/syllabi':     BACKEND,
      '/assessments': BACKEND,
      // Trailing slash so this matches API calls (/analytics/me/..., /analytics/admin/...)
      // but NOT the SPA route /analytics-page, which must fall through to index.html.
      '/analytics/':  BACKEND,
      '/health':      BACKEND,
      '/resources':   BACKEND,
      '/recommendations': BACKEND,
      '/programs':    BACKEND,
      '/curricula':   BACKEND,
      '/sections':    BACKEND,
      '/enrollments': BACKEND,
      '/grade-submissions': BACKEND,
      '/notifications': BACKEND,
      '/surveys':     BACKEND,
      '/attendance':  BACKEND,
      // Trailing slash so this matches /consent/status & /consent/accept (API) but
      // NOT the SPA route /consent (the student consent page) on a hard refresh.
      '/consent/':    BACKEND,
      // Trailing slash: API calls (/reports/...) go to the backend, the SPA page /reports does not.
      '/reports/':    BACKEND,
    },
  },
})
