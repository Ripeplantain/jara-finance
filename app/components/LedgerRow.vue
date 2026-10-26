<script setup lang="ts">
import type { LedgerEntry } from '~/utils/ledger'

/**
 * One ledger row, as v1 draws it: glyph, what and where, signed amount.
 *
 * Direction is the sign and the wording; colour is only a hint. A transfer is
 * shown unsigned and muted, so it can never be read as income or spending.
 * `interactive` makes the row a button (the ledger opens a detail sheet from
 * it); on Home it is a plain row. Attributes such as `aria-label` and `@click`
 * fall through to the root element.
 */
defineProps<{ entry: LedgerEntry, interactive?: boolean }>()
</script>

<template>
  <component :is="interactive ? 'button' : 'div'" :type="interactive ? 'button' : undefined" class="j-row">
    <CategoryGlyph
      :icon="entry.categoryIcon"
      :color-index="entry.categoryColorIndex"
      :transfer="entry.type === 'transfer'"
    />
    <span>
      <span class="t" style="display: block">{{ entryTitle(entry) }}</span>
      <span class="s" style="display: block">{{ entrySubline(entry) }}</span>
    </span>
    <MoneyAmount
      class="amt"
      :class="entry.type === 'income' ? 'is-in' : entry.type === 'transfer' ? 'is-flat' : ''"
      size="plain"
      :pesewas="entry.type === 'expense' ? -entry.amountPesewas : entry.amountPesewas"
      :signed="entry.type !== 'transfer'"
    />
  </component>
</template>
