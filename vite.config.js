import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves this repo under https://<user>.github.io/-/
// so all asset paths need to be prefixed with `/-/`.
// Locally and during tests the base is just `/`.
const isProd = process.env.NODE_ENV === 'production' || process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  base: isProd ? '/-/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Spark Joy 怦然心动整理',
        short_name: 'Spark Joy',
        description: 'A KonMari-inspired decluttering helper / 近藤麻理惠式整理引导',
        theme_color: '#f5d0c5',
        background_color: '#fdfaf6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})

