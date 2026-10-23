<template>
  <div class="grid min-h-dvh bg-background lg:grid-cols-[minmax(22rem,0.85fr)_1.15fr]">
    <aside class="relative hidden overflow-hidden bg-shell p-10 text-shell-foreground lg:flex lg:flex-col lg:justify-between">
      <NuxtLink to="/" class="flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-shell-foreground">
        <SaloMark class="size-9" title="Jara" />
        <span class="text-xl font-semibold tracking-tight">Jara</span>
      </NuxtLink>

      <div class="relative z-10 max-w-md">
        <p class="text-sm font-medium text-shell-muted">Your money, made legible.</p>
        <h1 class="mt-3 text-4xl font-semibold leading-tight tracking-tight">
          Plan with the money you actually have.
        </h1>
        <p class="mt-4 max-w-sm text-sm leading-relaxed text-shell-muted">
          Track every cedi, protect what you have promised, and know what is safe to spend.
        </p>
      </div>

      <div class="grid grid-cols-8 gap-1 opacity-55" aria-hidden="true">
        <span v-for="index in 32" :key="index" class="aspect-square border border-shell-muted/50" :class="index < 12 ? 'bg-shell-muted/30' : ''" />
      </div>
    </aside>

    <main class="stock-ruled grid min-h-dvh place-items-center px-4 py-10 sm:px-8">
      <div class="w-full max-w-md">
        <div class="mb-7 flex items-center gap-3 lg:hidden">
          <span class="grid size-11 place-items-center bg-shell text-shell-foreground">
            <SaloMark class="size-6" title="Jara" />
          </span>
          <div>
            <p class="font-semibold tracking-tight">Jara</p>
            <p class="text-xs text-muted-foreground">Know what is safe to spend.</p>
          </div>
        </div>
        <slot />
      </div>
    </main>
  </div>
</template>
