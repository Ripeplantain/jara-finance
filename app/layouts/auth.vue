<template>
  <div class="flex min-h-dvh flex-col bg-background text-foreground">
    <header class="mx-auto w-full max-w-[1136px] px-5 pt-6 sm:px-8 lg:px-12">
      <NuxtLink
        to="/"
        class="flex min-h-11 w-fit items-center gap-2.5 text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Jara home"
      >
        <JaraMark class="size-7" />
        <span class="font-display text-[1.55rem] font-medium leading-none">Jara</span>
      </NuxtLink>
    </header>

    <main class="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center px-5 pb-20 pt-10 sm:px-0">
      <slot />
    </main>
  </div>
</template>
