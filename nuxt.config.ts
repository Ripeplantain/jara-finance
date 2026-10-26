import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  modules: ['@nuxt/eslint', '@nuxt/fonts', 'shadcn-nuxt'],

  devtools: { enabled: true },

  // Port 3000 is occupied by another local app; pin Jara so auth callback URLs stay stable.
  devServer: { port: 3100 },

  css: ['~/assets/css/main.css', '~/assets/css/v1.css'],

  // Goals now live inside Budgets.

  vite: {
    plugins: [tailwindcss()]
  },

  shadcn: {
    prefix: '',
    componentDir: 'app/components/ui'
  },

  /*
    Two families, one job each. Fraunces (400, 500) is the voice: wordmark,
    headings and the large figures. Instrument Sans (400-600) carries the
    interface and has tabular figures for the money path. Self-hosted by the
    module, which also writes fallback metric overrides so text does not shift
    when the files arrive. Fraunces' optical-size axis is not requested: the
    google provider serves the static weights only, so the design does not rely
    on font-variation-settings.
  */
  fonts: {
    families: [
      { name: 'Fraunces', provider: 'google', weights: [400, 500] },
      { name: 'Instrument Sans', provider: 'google', weights: [400, 500, 600] }
    ],
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
        // Matches the deep teal primary (--primary, light theme).
        { name: 'theme-color', content: '#14574f' }
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
          // than having no dark mode at all. Light is the default: only an
          // explicit choice of dark (or of "system", stored as 'system') turns
          // the device preference into dark.
          innerHTML:
            "try{var t=localStorage.getItem('salo-theme');if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}",
          tagPosition: 'head'
        }
      ]
    }
  }
})
