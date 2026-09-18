import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the Django API runs on :8000; proxying keeps the app and API on one origin.
const API = process.env.VITE_API_PROXY ?? 'http://127.0.0.1:8000'
// Phones only allow the camera on https (or localhost), so `npm run dev:phone` serves a self-signed certificate.
const https = process.env.VITE_HTTPS === '1'

export default defineConfig({
  plugins: [react(), ...(https ? [basicSsl({ name: 'shop-inventory-dev' })] : [])],
  server: {
    host: true, // reachable from a phone on the same Wi-Fi
    proxy: {
      '/api': API,
      '/media': API,
    },
  },
})
