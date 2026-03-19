import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'WatchOver — Intelligence Dashboard',
        short_name: 'WatchOver',
        description: 'Real-time geopolitical intelligence & forecasting dashboard',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  // =============================================
  // Performance Optimizations (Phase 5.5)
  // =============================================
  build: {
    target: 'es2020', // Modern browsers only — smaller, faster code
    sourcemap: false, // Disable source maps in production
    rollupOptions: {
      output: {
        // Manual chunk splitting: separate large libraries into their own
        // cacheable chunks so the main bundle stays lean
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Map/Globe rendering (heaviest deps)
          'vendor-map': [
            'maplibre-gl',
            'react-map-gl',
            '@deck.gl/core',
            '@deck.gl/react',
            '@deck.gl/layers',
            '@deck.gl/aggregation-layers',
          ],
          // Data visualization
          'vendor-d3': ['d3'],
          // Auth
          'vendor-clerk': ['@clerk/clerk-react', '@clerk/themes'],
          // Data fetching
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
    // Increase the chunk size warning limit (map deps are inherently large)
    chunkSizeWarningLimit: 800,
  },
})

