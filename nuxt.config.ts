import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  modules: ['@nuxt/eslint', '@nuxt/fonts', 'shadcn-nuxt'],

  devtools: { enabled: true },

  // Port 3000 is occupied by another local app; pin Jara so auth callback URLs stay stable.
  devServer: { port: 3100 },

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()]
  },

  shadcn: {
    prefix: '',
    componentDir: 'app/components/ui'
  },

  /*
    One family does both jobs. Archivo is a workhorse grotesque with true
    tabular figures, which the whole money path depends on, and enough weight
    range to carry the verdict at display size — so the app ships one typeface
    instead of a UI face plus a numeric face. Self-hosted by the module, which
    also writes the fallback metric overrides, so a user on metered data pays
    for four weights once and the text does not shift when they arrive.
  */
  fonts: {
    families: [{ name: 'Archivo', provider: 'google', weights: [400, 500, 600, 700] }],
    defaults: { subsets: ['latin'] }
  },

  typescript: {
    strict: true,
    typeCheck: false
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    betterAuthSecret: process.env.BETTER_AUTH_SECRET || '',
    betterAuthUrl: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    // AI provider is swappable: 'openrouter' | 'anthropic' | 'openai'
    aiProvider: process.env.AI_PROVIDER || 'openrouter',
    aiModel: process.env.AI_MODEL || '',
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    aiDailyMessageLimit: process.env.AI_DAILY_MESSAGE_LIMIT || '25',
    public: {
      appName: 'Jara Finance',
      defaultCurrency: 'GHS',
      defaultTimezone: 'Africa/Accra'
    }
  },

  app: {
    head: {
      title: 'Jara — know where your money goes',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        {
          name: 'description',
          content:
            'Jara Finance is an AI-powered personal finance coach. Track income and expenses, build budgets, hit savings goals, and know what you can afford.'
        },
        // Matches the ultramarine brand surface used by the Jara mark.
        { name: 'theme-color', content: '#4f46e5' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icon-32.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
      ],
      script: [
        {
          // Applies the stored theme before first paint. Without this the page
          // renders light and then snaps to dark on hydration, which is worse
          // than having no dark mode at all.
          innerHTML:
            "try{var t=localStorage.getItem('salo-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}",
          tagPosition: 'head'
        }
      ]
    }
  }
})
