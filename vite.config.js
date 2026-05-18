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
      includeAssets: ['favicon.svg', 'icon-192.svg', 'icon-512.svg'],
      manifest: {
        name: '一日五色表 · Five Color Planner',
        short_name: '五色表',
        description: '基于叶老师智慧时间法的个人打卡与记录工具',
        theme_color: '#1a1a1a',
        background_color: '#fafafa',
        display: 'standalone',
        orientation: 'any',
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
