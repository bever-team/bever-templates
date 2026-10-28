import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

const modelPath = fileURLToPath(new URL('../bev/.output/model.json', import.meta.url))
if (!existsSync(modelPath)) {
  throw new Error('bev/.output/model.json is missing. Run "bever dev" (or "bever compile") in the project folder first.')
}

// The API runs on its own port during development; the dev server proxies /api to it so the app
// and the API share one origin, exactly as they do in production.
const apiUrl = process.env.BEVER_API_URL ?? 'http://localhost:5100'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  srcDir: 'src/',
  components: false,
  devtools: { enabled: false },
  telemetry: false,
  app: {
    head: {
      title: '__PROJECT_DISPLAY_NAME__',
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
  runtimeConfig: {
    public: {
      appName: '__PROJECT_DISPLAY_NAME__',
    },
  },
  css: ['~/assets/index.css'],
  nitro: {
    devProxy: {
      '/api': { target: `${apiUrl}/api`, changeOrigin: true },
    },
    // 'npm run generate' writes the built app where the server serves it from.
    output: {
      publicDir: fileURLToPath(new URL('../server/wwwroot', import.meta.url)),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    // Pre-bundled up front, so the first page load in development does not trigger a reload.
    optimizeDeps: {
      include: ['@bever/sdk', '@lucide/vue', '@vueuse/core', 'class-variance-authority', 'clsx', 'reka-ui', 'tailwind-merge', 'vue-sonner'],
    },
    server: {
      fs: { allow: [fileURLToPath(new URL('../', import.meta.url))] },
    },
  },
  hooks: {
    'pages:extend'(pages) {
      // Page implementations live next to Nuxt's route files; only the route files are routes.
      for (let index = pages.length - 1; index >= 0; index--) {
        if (pages[index]?.file?.endsWith('Page.vue')) pages.splice(index, 1)
      }
    },
  },
})
