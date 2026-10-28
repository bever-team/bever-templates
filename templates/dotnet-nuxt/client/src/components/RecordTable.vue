<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon, SearchXIcon } from '@lucide/vue'
import type { BeverEntity, BeverRecord, ResolvedActionPresentation, ResolvedPresentationField } from '@bever/sdk'
import { formatValue, sortKey } from '@/bever/format'
import { actionsAt, changedPayload, hasCompleteEditContext, seedExperience } from '@/bever/presentation'
import { readField, recordId, referenceLabel } from '@/bever/records'
import { fieldErrors, requestError, usableOn } from '@/bever/session'
import { confirm } from '@/bever/confirm'
import DynamicForm from '@/components/DynamicForm.vue'
import FieldValue from '@/components/FieldValue.vue'
import StatePanel from '@/components/StatePanel.vue'
import { Button } from '@/components/ui/button'
import RecordActions from '@/components/RecordActions.vue'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const PAGE_SIZE = 25

const props = defineProps<{
  entity: BeverEntity
  records: BeverRecord[]
  contextKey: string
  query?: string
  saveInline: (id: string, payload: Record<string, unknown>) => Promise<BeverRecord>
}>()

const emit = defineEmits<{
  (e: 'view', record: BeverRecord): void
  (e: 'edit', record: BeverRecord): void
  (e: 'delete', record: BeverRecord): void
  (e: 'reconciled', previous: BeverRecord, next: BeverRecord): void
  (e: 'clear-query'): void
}>()

const columns = computed(() => props.entity.presentation.listing)
const rowActions = computed(() => actionsAt(props.entity, 'ListingRow'))
const readAction = computed(() => rowActions.value.find((action) => action.action.verb === 'Read'))
const updateAction = computed(() => rowActions.value.find((action) => action.action.verb === 'Update'))

// Search matches what the table shows; sorting follows the column's type. Unsorted keeps the server's order.
const sort = ref<{ field: string, direction: 'asc' | 'desc' } | null>(null)
const page = ref(1)
const display = (record: BeverRecord, item: ResolvedPresentationField) =>
  item.field.type?.kind === 'Relationship' ? referenceLabel(record, item.field) : formatValue(item.field, readField(record, item.field))
const filtered = computed(() => {
  const terms = (props.query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return props.records
  return props.records.filter((record) => {
    const text = columns.value.map((item) => display(record, item)).join(' ').toLowerCase()
    return terms.every((term) => text.includes(term))
  })
})
const sorted = computed(() => {
  const current = sort.value
  const column = current && columns.value.find((item) => item.field.name === current.field)
  if (!current || !column) return filtered.value
  const key = (record: BeverRecord) => column.field.type?.kind === 'Relationship' ? referenceLabel(record, column.field).toLowerCase() : sortKey(column.field, readField(record, column.field))
  const direction = current.direction === 'asc' ? 1 : -1
  return [...filtered.value].sort((left, right) => {
    const a = key(left)
    const b = key(right)
    if (a === '' || b === '') return a === b ? 0 : a === '' ? 1 : -1
    return (a < b ? -1 : a > b ? 1 : 0) * direction
  })
})
const pageCount = computed(() => Math.max(1, Math.ceil(sorted.value.length / PAGE_SIZE)))
const visible = computed(() => sorted.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
const range = computed(() => `${(page.value - 1) * PAGE_SIZE + 1}–${Math.min(page.value * PAGE_SIZE, sorted.value.length)} of ${sorted.value.length}`)
watch(() => props.query, () => { page.value = 1 })
watch(pageCount, (count) => { if (page.value > count) page.value = count })

function toggleSort(field: string) {
  const current = sort.value
  sort.value = current?.field !== field ? { field, direction: 'asc' } : current.direction === 'asc' ? { field, direction: 'desc' } : null
}

function ariaSort(field: string) {
  return sort.value?.field !== field ? 'none' : sort.value.direction === 'asc' ? 'ascending' : 'descending'
}

// Inline editing: at most one row has a draft; Save sends one PATCH with the changed fields.
const activeRecord = ref<BeverRecord | null>(null)
const initial = ref<Record<string, unknown>>({})
const draft = ref<Record<string, unknown>>({})
const pending = ref(false)
const saveError = ref<string | null>(null)
const serverErrors = ref<Record<string, string>>({})
let operationGeneration = 0

watch(() => props.contextKey, () => invalidate(true))
watch(() => props.records, () => {
  if (activeRecord.value && !props.records.includes(activeRecord.value)) invalidate(true)
})

function canRun(action: ResolvedActionPresentation, record: BeverRecord) {
  return !!recordId(record) && usableOn(action.action, record) && (action.action.verb !== 'Update' || hasCompleteEditContext(props.entity, record))
}

function run(action: ResolvedActionPresentation, record: BeverRecord) {
  if (action.action.verb === 'Read') emit('view', record)
  else if (action.action.verb === 'Delete') emit('delete', record)
  else if (action.action.verb === 'Update') {
    if (props.entity.presentation.editing.mode === 'Inline') beginInline(record)
    else emit('edit', record)
  }
}

function open(record: BeverRecord) {
  if (readAction.value && !activeRecord.value) emit('view', record)
}

function beginInline(record: BeverRecord) {
  if (pending.value || activeRecord.value || !hasCompleteEditContext(props.entity, record)) return
  const seed = seedExperience(props.entity, props.entity.presentation.editing, record)
  if (!seed) return
  activeRecord.value = record
  initial.value = { ...seed }
  draft.value = { ...seed }
  saveError.value = null
  serverErrors.value = {}
}

function cancelInline() {
  if (!pending.value) invalidate()
}

function invalidate(contextLost = false) {
  if (contextLost) {
    operationGeneration++
    pending.value = false
  }
  activeRecord.value = null
  initial.value = {}
  draft.value = {}
  saveError.value = null
  serverErrors.value = {}
}

async function saveInline() {
  const record = activeRecord.value
  const id = recordId(record)
  if (!record || !id || pending.value) return
  const payload = changedPayload(props.entity, props.entity.presentation.editing, initial.value, draft.value)
  if (Object.keys(payload).length === 0) return invalidate()
  if (updateAction.value?.confirm && !await confirm({ title: updateAction.value.label, description: updateAction.value.confirm, action: updateAction.value.label })) return
  const contextAtStart = props.contextKey
  const operation = ++operationGeneration
  pending.value = true
  saveError.value = null
  serverErrors.value = {}
  try {
    const next = await props.saveInline(id, payload)
    if (operation === operationGeneration && contextAtStart === props.contextKey && activeRecord.value === record) {
      emit('reconciled', record, next)
      invalidate()
    }
  } catch (error) {
    if (operation === operationGeneration && contextAtStart === props.contextKey && activeRecord.value === record) {
      serverErrors.value = fieldErrors(error)
      saveError.value = Object.keys(serverErrors.value).length > 0 ? null : requestError(error, props.entity.presentation.label.toLowerCase())
    }
  } finally {
    if (operation === operationGeneration) pending.value = false
  }
}

// Wide screens get a table; phones get one card per record.
const wide = useMediaQuery('(min-width: 768px)')
const runnable = (record: BeverRecord) => rowActions.value.filter((action) => canRun(action, record))
const titleOf = (record: BeverRecord) => (columns.value[0] && display(record, columns.value[0])) || props.entity.presentation.label
</script>

<template>
  <StatePanel v-if="sorted.length === 0" :icon="SearchXIcon" title="No matches" :description="`No ${entity.presentation.pluralLabel.toLowerCase()} match “${query}”.`">
    <Button variant="outline" @click="emit('clear-query')">Clear search</Button>
  </StatePanel>
  <div v-else :class="wide && 'overflow-hidden rounded-xl border bg-card'">
    <Table v-if="wide">
      <TableHeader class="bg-muted/40">
        <TableRow class="hover:bg-transparent">
          <TableHead v-for="item in columns" :key="item.field.name" :aria-sort="ariaSort(item.field.name)" class="h-10">
            <button type="button" class="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 font-medium hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" @click="toggleSort(item.field.name)">
              {{ item.label }}
              <ArrowUpIcon v-if="sort?.field === item.field.name && sort.direction === 'asc'" class="size-3.5" />
              <ArrowDownIcon v-else-if="sort?.field === item.field.name" class="size-3.5" />
              <ChevronsUpDownIcon v-else class="size-3.5 opacity-40" />
            </button>
          </TableHead>
          <TableHead v-if="rowActions.length" class="w-12"><span class="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <template v-for="record in visible" :key="recordId(record)">
          <TableRow :class="readAction && !activeRecord && 'cursor-pointer'" :data-state="activeRecord === record ? 'selected' : undefined" @click="open(record)">
            <TableCell v-for="(item, index) in columns" :key="item.field.name" :class="['max-w-xs py-3 align-top', index === 0 && 'font-medium']">
              <FieldValue :field="item.field" :record="record" />
            </TableCell>
            <TableCell v-if="rowActions.length" class="py-2 text-right align-top" @click.stop>
              <RecordActions :actions="runnable(record)" :label="titleOf(record)" :disabled="pending || !!activeRecord" @run="(action) => run(action, record)" />
            </TableCell>
          </TableRow>
          <TableRow v-if="activeRecord === record" class="bg-muted/30 hover:bg-muted/30">
            <TableCell :colspan="columns.length + 1" class="p-4 sm:p-6">
              <DynamicForm
                v-model="draft" :entity="entity" :experience="entity.presentation.editing" :labels="record._labels"
                :identity-context="{ entityRoute: entity.routeName, action: 'Update', id: recordId(record)! }"
                :server-errors="serverErrors" :submitting="pending" :submit-label="updateAction?.label === 'Edit' ? 'Save changes' : updateAction?.label"
                compact @submit="saveInline" @cancel="cancelInline"
              />
              <p v-if="saveError" role="alert" class="mt-3 text-sm text-destructive">{{ saveError }}</p>
            </TableCell>
          </TableRow>
        </template>
      </TableBody>
    </Table>
    <ul v-else class="flex flex-col gap-3">
      <li v-for="record in visible" :key="recordId(record)" :class="['rounded-xl border bg-card p-4', readAction && !activeRecord && 'cursor-pointer']" @click="open(record)">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 pt-0.5 font-medium"><FieldValue v-if="columns[0]" :field="columns[0].field" :record="record" /></div>
          <div v-if="rowActions.length" @click.stop>
            <RecordActions :actions="runnable(record)" :label="titleOf(record)" :disabled="pending || !!activeRecord" @run="(action) => run(action, record)" />
          </div>
        </div>
        <dl v-if="columns.length > 1" class="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div v-for="item in columns.slice(1)" :key="item.field.name" class="min-w-0">
            <dt class="text-xs text-muted-foreground">{{ item.label }}</dt>
            <dd class="mt-0.5 truncate"><FieldValue :field="item.field" :record="record" /></dd>
          </div>
        </dl>
        <div v-if="activeRecord === record" class="mt-4 border-t pt-4" @click.stop>
          <DynamicForm
            v-model="draft" :entity="entity" :experience="entity.presentation.editing" :labels="record._labels"
            :identity-context="{ entityRoute: entity.routeName, action: 'Update', id: recordId(record)! }"
            :server-errors="serverErrors" :submitting="pending" :submit-label="updateAction?.label === 'Edit' ? 'Save changes' : updateAction?.label"
            compact @submit="saveInline" @cancel="cancelInline"
          />
          <p v-if="saveError" role="alert" class="mt-3 text-sm text-destructive">{{ saveError }}</p>
        </div>
      </li>
    </ul>
    <div v-if="pageCount > 1" :class="['flex items-center justify-between gap-4 py-3 text-sm text-muted-foreground', wide ? 'border-t px-4' : 'mt-1']">
      <span>{{ range }}</span>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="page === 1" @click="page--"><ChevronLeftIcon data-icon="inline-start" />Previous</Button>
        <Button variant="outline" size="sm" :disabled="page === pageCount" @click="page++">Next<ChevronRightIcon data-icon="inline-end" /></Button>
      </div>
    </div>
  </div>
</template>
