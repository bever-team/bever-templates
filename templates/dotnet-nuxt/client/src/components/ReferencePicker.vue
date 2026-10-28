<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronsUpDownIcon, XIcon } from '@lucide/vue'
import type { IdentityLookupContext, ReferenceSummary, ResolvedInputPresentation } from '@bever/sdk'
import { useBeverClient } from '@/bever/model'
import { requestError } from '@/bever/session'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ReferenceOptions from '@/components/ReferenceOptions.vue'

// Chooses a related record through the server's lookup for the field's picker. It shows labels only:
// never record IDs, never a manual ID field, and never a whole-list download.
const props = defineProps<{
  picker: ResolvedInputPresentation
  modelValue: unknown
  required?: boolean
  label: string
  identityContext?: IdentityLookupContext
  /** Label of the stored selection from the edited record's `_labels`; null when the visitor may not see it. */
  currentLabel?: string | null
  id?: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: string | null): void, (e: 'blur'): void }>()

const client = useBeverClient()
const items = ref<ReferenceSummary[]>([])
const selected = ref<ReferenceSummary | null>(null)
const loading = ref(false)
const loaded = ref(false)
const error = ref<string | null>(null)
const nextCursor = ref<string | null>(null)
const search = ref('')
const open = ref(false)
let requestId = 0
let debounce: ReturnType<typeof setTimeout> | undefined
let abort: AbortController | undefined

const NONE = '__none__'
const capability = computed(() => props.picker.capability)
const searchable = computed(() => capability.value.supported && capability.value.searchable)
const selectedId = computed(() => typeof props.modelValue === 'string' && props.modelValue.length > 0 ? props.modelValue : null)
const identityContext = computed(() => capability.value.supported && capability.value.kind === 'SystemIdentity' ? props.identityContext : undefined)
const pickedHere = computed(() => selected.value !== null && selected.value.id === selectedId.value)
const unavailable = computed(() => selectedId.value !== null && !pickedHere.value && typeof props.currentLabel !== 'string')
const selectedLabel = computed(() => {
  if (selectedId.value === null) return null
  if (pickedHere.value) return selected.value!.label || 'Untitled'
  return typeof props.currentLabel === 'string' ? props.currentLabel || 'Untitled' : 'Unavailable'
})
const placeholder = computed(() => `Choose ${props.label.toLowerCase()}`)
const tooMany = computed(() => props.picker.display === 'Dropdown' && nextCursor.value !== null)
const dropdownValue = computed<string>({
  get: () => selectedId.value ?? (props.required ? '' : NONE),
  set: (id) => {
    if (id === NONE) return clear()
    const item = items.value.find((candidate) => candidate.id === id)
    if (item) choose(item)
  },
})

async function load(reset = true, cursor?: string | null) {
  const current = capability.value
  if (!current.supported) return
  if (current.kind === 'SystemIdentity' && !identityContext.value) {
    error.value = 'People can only be chosen while creating or editing a record.'
    return
  }
  const id = ++requestId
  abort?.abort()
  abort = new AbortController()
  loading.value = true
  error.value = null
  try {
    const request = props.picker.display === 'Dropdown'
      ? { limit: 50 }
      : { search: searchable.value ? search.value : '', limit: 20, ...(cursor ? { cursor } : {}) }
    const response = identityContext.value
      ? await client.lookupIdentities(identityContext.value, request, { signal: abort.signal })
      : await client.lookupReferences(current.targetRouteName, { ...request, ...(current.kind === 'Application' && current.picker ? { picker: current.picker } : {}) }, { signal: abort.signal })
    if (id !== requestId) return
    items.value = reset ? response.items : [...items.value, ...response.items]
    nextCursor.value = response.nextCursor
    loaded.value = true
  } catch (cause) {
    if (id === requestId && !(cause instanceof DOMException && cause.name === 'AbortError')) error.value = requestError(cause, `this ${props.label.toLowerCase()}`)
  } finally {
    if (id === requestId) loading.value = false
  }
}

function choose(item: ReferenceSummary) {
  selected.value = item
  emit('update:modelValue', item.id)
  open.value = false
}

function clear() {
  if (!props.required) emit('update:modelValue', null)
}

watch(open, (isOpen) => {
  if (!isOpen) return emit('blur')
  if (!loaded.value || search.value) {
    search.value = ''
    void load(true)
  }
})

watch(search, () => {
  if (!searchable.value || props.picker.display === 'Dropdown') return
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => { void load(true) }, 250)
})

onMounted(() => { if (props.picker.display === 'Dropdown') void load(true) })
onBeforeUnmount(() => { abort?.abort(); if (debounce) clearTimeout(debounce) })
</script>

<template>
  <p v-if="!capability.supported" role="alert" class="text-sm text-destructive">{{ capability.message }}</p>

  <div v-else-if="picker.display === 'Dropdown'" class="flex flex-col gap-1.5" data-picker-display="Dropdown">
    <p v-if="tooMany" role="alert" class="text-sm text-destructive">
      There are too many {{ label.toLowerCase() }} records for a dropdown. Use the Combobox or Modal picker.
    </p>
    <Select v-else v-model="dropdownValue" :disabled="loading && !loaded">
      <SelectTrigger :id="id" class="w-full" :aria-label="label">
        <SelectValue>
          <span v-if="selectedLabel === null" class="text-muted-foreground">{{ loading && !loaded ? 'Loading…' : required ? placeholder : 'None' }}</span>
          <span v-else :class="unavailable && 'italic text-muted-foreground'">{{ selectedLabel }}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-if="!required" :value="NONE" class="text-muted-foreground">None</SelectItem>
        <SelectItem v-for="item in items" :key="item.id" :value="item.id">{{ item.label || 'Untitled' }}</SelectItem>
      </SelectContent>
    </Select>
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
  </div>

  <div v-else class="flex items-center gap-1" :data-picker-display="picker.display">
    <Popover v-if="picker.display === 'Combobox'" v-model:open="open">
      <PopoverTrigger as-child>
        <Button :id="id" type="button" variant="outline" role="combobox" :aria-expanded="open" class="min-w-0 flex-1 justify-between font-normal">
          <span :class="['truncate', selectedLabel === null && 'text-muted-foreground', unavailable && 'italic text-muted-foreground']">{{ selectedLabel ?? placeholder }}</span>
          <ChevronsUpDownIcon class="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" class="w-(--reka-popover-trigger-width) min-w-64 p-0">
        <ReferenceOptions
          v-model:search="search" :label="label" :items="items" :selected-id="selectedId" :searchable="searchable"
          :loading="loading" :loaded="loaded" :error="error" :has-more="nextCursor !== null" @choose="choose" @load-more="load(false, nextCursor)"
        />
      </PopoverContent>
    </Popover>
    <Dialog v-else v-model:open="open">
      <Button :id="id" type="button" variant="outline" :aria-expanded="open" class="min-w-0 flex-1 justify-between font-normal" @click="open = true">
        <span :class="['truncate', selectedLabel === null && 'text-muted-foreground', unavailable && 'italic text-muted-foreground']">{{ selectedLabel ?? placeholder }}</span>
        <ChevronsUpDownIcon class="text-muted-foreground" />
      </Button>
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose {{ label.toLowerCase() }}</DialogTitle>
          <DialogDescription>{{ searchable ? 'Search or browse the available records.' : 'Browse the available records.' }}</DialogDescription>
        </DialogHeader>
        <ReferenceOptions
          v-model:search="search" bordered :label="label" :items="items" :selected-id="selectedId" :searchable="searchable"
          :loading="loading" :loaded="loaded" :error="error" :has-more="nextCursor !== null" @choose="choose" @load-more="load(false, nextCursor)"
        />
      </DialogContent>
    </Dialog>
    <Button v-if="!required && selectedId" type="button" variant="ghost" size="icon" :aria-label="`Clear ${label.toLowerCase()}`" data-test="clear-reference" @click="clear">
      <XIcon />
    </Button>
  </div>
</template>
