import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// When deployed to GitHub Pages this app would live under a sub-path.
// Locally and during tests the base is just `/`. Adjust `base` if you
// deploy under a project page (e.g. '/perk-pilot/').
const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  base: isProd ? './' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'PerkPilot 薅卡管家',
        short_name: 'PerkPilot',
        description: 'Track credit-card perks, payment due dates and reward points so you never leave value on the table. / 管理信用卡福利、还款到期与积分，福利薅尽不浪费。',
        theme_color: '#0f766e',
        background_color: '#0b1120',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: 'icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      }
    })
  ]
})
