<script setup lang="ts">
import { authClient } from '~/lib/auth-client'
import { toApiError } from '~/lib/errors'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Sign in — Jara' })

const route = useRoute()
const { refresh } = useCurrentUser()

const email = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)

async function submit() {
  error.value = ''
  pending.value = true
  try {
    const { error: authError } = await authClient.signIn.email({
      email: email.value,
      password: password.value
    })
    if (authError) {
      // Better Auth returns a deliberately vague message for bad credentials so
      // the form can't be used to discover which emails have accounts.
      error.value = authError.message ?? 'Those details did not match an account'
      return
    }
    // Repopulate `/api/me` before navigating, so the route middleware sees a
    // signed-in user instead of bouncing straight back here.
    await refresh()
    await navigateTo((route.query.redirect as string) || '/')
  } catch (caught) {
    error.value = toApiError(caught, 'Could not sign in').message
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="font-display text-[2.25rem] leading-[1.1] sm:text-[2.5rem]">Welcome back</h1>
    <p class="mt-3 text-[0.95rem] text-muted-foreground">Sign in to pick up where you left off.</p>

    <form class="mt-8 flex flex-col gap-5" @submit.prevent="submit">
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
          <Input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </div>

        <p v-if="error" class="status-strip status-strip-error" role="alert">{{ error }}</p>

        <Button type="submit" class="min-h-11" :disabled="pending">
          {{ pending ? 'Signing in…' : 'Sign in' }}
        </Button>
    </form>

    <p class="mt-8 text-sm text-muted-foreground">
        New here?
        <NuxtLink to="/signup" class="font-medium text-primary hover:underline">
          Create an account
        </NuxtLink>
    </p>
  </div>
</template>
