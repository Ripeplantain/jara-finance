<template>
  <div class="grid min-h-dvh bg-background lg:grid-cols-[minmax(24rem,0.95fr)_1.05fr]">
    <aside class="metric-surface relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
      <NuxtLink to="/" class="relative z-10 flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground">
        <span class="grid size-11 place-items-center rounded-xl bg-primary-foreground/14 ring-1 ring-inset ring-primary-foreground/20">
          <JaraMark class="size-7" title="Jara" />
        </span>
        <span class="text-xl font-bold tracking-tight">Jara</span>
      </NuxtLink>

      <div class="relative z-10 max-w-lg">
        <p class="text-sm font-semibold text-primary-foreground/72">Your next money decision, clearer.</p>
        <h1 class="mt-4 text-5xl font-bold leading-[1.02] tracking-[-0.04em] xl:text-6xl">
          Know what is safe to spend.
        </h1>
        <p class="mt-5 max-w-md text-base leading-relaxed text-primary-foreground/72">
          Bring cash, Mobile Money and bank accounts into one calm view—then protect the plans that matter.
        </p>
      </div>

      <div class="relative z-10 max-w-md rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-5 backdrop-blur-sm">
        <div class="flex items-center justify-between text-xs font-semibold text-primary-foreground/75">
          <span>Your money at a glance</span>
          <span>Live view</span>
        </div>
        <div class="mt-5 flex h-4 overflow-hidden rounded-full bg-primary-foreground/14">
          <span class="w-[24%] bg-primary-foreground/35" />
          <span class="w-[31%] bg-aqua/80" />
          <span class="w-[45%] bg-primary-foreground" />
        </div>
        <div class="mt-4 grid grid-cols-3 gap-3 text-xs text-primary-foreground/70">
          <span>Goals</span><span>Budget</span><span class="text-right">Available</span>
        </div>
      </div>

      <span class="absolute -right-24 -top-28 size-96 rounded-full border-[64px] border-primary-foreground/5" aria-hidden="true" />
      <span class="absolute -bottom-44 -left-24 size-[30rem] rounded-full border-[72px] border-aqua/10" aria-hidden="true" />
    </aside>

    <main class="grid min-h-dvh place-items-center px-4 py-10 sm:px-8">
      <div class="w-full max-w-md">
        <div class="mb-8 flex items-center gap-3 lg:hidden">
          <span class="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <JaraMark class="size-6" title="Jara" />
          </span>
          <div>
            <p class="font-bold tracking-tight">Jara</p>
            <p class="text-xs text-muted-foreground">Know what is safe to spend.</p>
          </div>
        </div>
        <slot />
      </div>
    </main>
  </div>
</template>
