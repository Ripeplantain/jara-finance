<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next'

/**
 * A password field with a show/hide toggle. Attributes such as `id`,
 * `autocomplete` and `required` fall through to the input, not the wrapper,
 * so a `<Label for>` still targets the field.
 */
defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: '' })
const visible = ref(false)
</script>

<template>
  <div class="relative">
    <Input
      v-bind="$attrs"
      v-model="model"
      :type="visible ? 'text' : 'password'"
      class="pr-11"
    />
    <button
      type="button"
      class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      :aria-label="visible ? 'Hide password' : 'Show password'"
      :aria-pressed="visible"
      @click="visible = !visible"
    >
      <EyeOff v-if="visible" class="size-4" aria-hidden="true" />
      <Eye v-else class="size-4" aria-hidden="true" />
    </button>
  </div>
</template>
