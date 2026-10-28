<script setup lang="ts">
import { computed } from 'vue'
import type { BeverRecord, FieldModel } from '@bever/sdk'
import { entityRouteName } from '@bever/sdk'
import { formatValue } from '@/bever/format'
import { canRead, entityByName } from '@/bever/presentation'
import { readField, referenceLabel } from '@/bever/records'
import { Badge } from '@/components/ui/badge'

// One field of a record, rendered by type. Relationships show the server's label, never an ID.
const props = defineProps<{ field: FieldModel, record: BeverRecord, detail?: boolean }>()

const type = computed(() => props.field.type)
const raw = computed(() => readField(props.record, props.field))
const isReference = computed(() => type.value?.kind === 'Relationship')
const text = computed(() => isReference.value ? referenceLabel(props.record, props.field) : formatValue(props.field, raw.value))
const referenceLink = computed(() => {
  if (!isReference.value || typeof raw.value !== 'string' || text.value === 'Unavailable' || type.value?.targetKind !== 'Application') return undefined
  const target = entityByName(type.value.targets[0] ?? '')
  return target && canRead(target) ? `/${entityRouteName(target.name)}/${encodeURIComponent(raw.value)}` : undefined
})
const href = computed(() => {
  if (typeof raw.value !== 'string' || raw.value === '') return undefined
  if (type.value?.name === 'Url') return raw.value
  if (type.value?.name === 'Email') return `mailto:${raw.value}`
  if (type.value?.name === 'Phone') return `tel:${raw.value.replace(/[^\d+]/g, '')}`
  return undefined
})
</script>

<template>
  <span v-if="text === ''" class="text-muted-foreground" aria-label="Empty">—</span>
  <NuxtLink v-else-if="referenceLink" :to="referenceLink" class="font-medium underline-offset-4 hover:underline" @click.stop>{{ text }}</NuxtLink>
  <span v-else-if="isReference" :class="text === 'Unavailable' && 'text-muted-foreground italic'">{{ text }}</span>
  <Badge v-else-if="type?.kind === 'Enum'" variant="secondary">{{ text }}</Badge>
  <a v-else-if="href" :href="href" class="underline-offset-4 hover:underline" :target="type?.name === 'Url' ? '_blank' : undefined" rel="noopener noreferrer" @click.stop>{{ text }}</a>
  <span v-else-if="type?.name === 'Boolean'" :class="raw ? '' : 'text-muted-foreground'">{{ text }}</span>
  <span v-else-if="detail" class="whitespace-pre-wrap break-words">{{ text }}</span>
  <span v-else class="line-clamp-2 break-words" :title="text.length > 80 ? text : undefined">{{ text }}</span>
</template>
