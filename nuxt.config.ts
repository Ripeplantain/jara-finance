import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  modules: ['@nuxt/eslint', 'shadcn-nuxt'],

  devtools: { enabled: true },

  // Port 3000 is occupied by another local app; pin Salo so auth callback URLs stay stable.
  devServer: { port: 3100 },

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()]
  },

  shadcn: {
    prefix: '',
    componentDir: 'app/components/ui'
  },

  typescript: {
    strict: true,
    typeCheck: false
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    betterAuthSecret: process.env.BETTER_AUTH_SECRET || '',
    betterAuthUrl: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    // AI provider is swappable: 'anthropic' | 'openai'
    aiProvider: process.env.AI_PROVIDER || 'anthropic',
    aiModel: process.env.AI_MODEL || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    aiDailyMessageLimit: process.env.AI_DAILY_MESSAGE_LIMIT || '25',
    public: {
      appName: 'Salo',
      defaultCurrency: 'GHS',
      defaultTimezone: 'Africa/Accra'
    }
  },

  app: {
    head: {
      title: 'Salo — know where your money goes',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        {
          name: 'description',
          content:
            'Salo is an AI-powered personal finance coach. Track income and expenses, build budgets, hit savings goals, and know what you can afford.'
        }
      ]
    }
  }
})
