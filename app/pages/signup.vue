<script setup lang="ts">
import { authClient } from '~/lib/auth-client'
import { toApiError } from '~/lib/errors'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Create your account — Jara' })

const { refresh } = useCurrentUser()

const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)

// Mirrors `minPasswordLength` in the Better Auth config. Checked here only to
// fail fast in the form — the server is still the authority.
const MIN_PASSWORD_LENGTH = 8

async function submit() {
  error.value = ''
  if (password.value.length < MIN_PASSWORD_LENGTH) {
    error.value = `Use at least ${MIN_PASSWORD_LENGTH} characters`
    return
  }

  pending.value = true
  try {
    const { error: authError } = await authClient.signUp.email({
      name: name.value,
      email: email.value,
      password: password.value
    })
    if (authError) {
      error.value = authError.message ?? 'Could not create your account'
      return
    }
    await refresh()
    // A brand-new account has no profile, so onboarding is the only sensible
    // destination; the middleware would send them here anyway.
    await navigateTo('/onboarding')
  } catch (caught) {
    error.value = toApiError(caught, 'Could not create your account').message
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="font-display text-[2.25rem] leading-[1.1] sm:text-[2.5rem]">Create your account</h1>
    <p class="mt-3 text-[0.95rem] text-muted-foreground">Free, and takes about a minute.</p>

    <form class="mt-8 flex flex-col gap-5" @submit.prevent="submit">
        <div class="flex flex-col gap-2">
          <Label for="name">Name</Label>
          <Input id="name" v-model="name" autocomplete="name" required placeholder="Ama Mensah" />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="email">Email</Label>
          <Input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            placeholder="you@example.com"
          />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="password">Password</Label>
          <PasswordInput
            id="password"
            v-model="password"
            autocomplete="new-password"
            required
          />
          <p class="text-xs text-muted-foreground">At least {{ MIN_PASSWORD_LENGTH }} characters.</p>
        </div>

        <p v-if="error" class="status-strip status-strip-error" role="alert">{{ error }}</p>

        <Button type="submit" class="min-h-11" :disabled="pending">
          {{ pending ? 'Creating…' : 'Create account' }}
        </Button>
    </form>

    <p class="mt-8 text-sm text-muted-foreground">
        Already have an account?
        <NuxtLink to="/login" class="font-medium text-primary hover:underline">Sign in</NuxtLink>
    </p>
  </div>
</template>
