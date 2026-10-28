<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { CircleAlertIcon, CompassIcon, InboxIcon, PlusIcon, SearchIcon } from '@lucide/vue'
import type { BeverRecord } from '@bever/sdk'
import { useBeverClient } from '@/bever/model'
import { findEntityByRoute } from '@/bever/useEntity'
import { actionAt, changedPayload, createLabel, creatorFields, experiencePayload, hasCompleteEditContext, readRequiresSignIn, recordLabel, seedExperience } from '@/bever/presentation'
import { retainEditContext } from '@/bever/editContext'
import { recordId } from '@/bever/records'
import { confirm } from '@/bever/confirm'
import { fieldErrors, requestError, session } from '@/bever/session'
import DynamicForm from '@/components/DynamicForm.vue'
import PageHeader from '@/components/PageHeader.vue'
import RecordTable from '@/components/RecordTable.vue'
import SignInPanel from '@/components/SignInPanel.vue'
import StatePanel from '@/components/StatePanel.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

const route = useRoute()
const router = useRouter()
const client = useBeverClient()
const entityRoute = computed(() => String(route.params.entityRoute ?? ''))
const entity = computed(() => findEntityByRoute(entityRoute.value))
const createAction = computed(() => entity.value && actionAt(entity.value, 'Create', 'ListingToolbar'))
const updateAction = computed(() => entity.value && actionAt(entity.value, 'Update', 'ListingRow'))
const deleteAction = computed(() => entity.value && actionAt(entity.value, 'Delete', 'ListingRow'))
const canList = computed(() => !!entity.value && entity.value.presentation.actions.some((item) => item.action.verb === 'Read'))
const needsSignIn = computed(() => session.known && !!entity.value && readRequiresSignIn(entity.value))
const records = ref<BeverRecord[]>([])
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const query = ref('')
const dialog = ref<'create' | 'edit' | null>(null)
const dialogRecord = ref<BeverRecord | null>(null)
const formValue = ref<Record<string, unknown>>({})
const serverErrors = ref<Record<string, string>>({})
const submitting = ref(false)
const creatorFixed = computed(() => entity.value ? Object.fromEntries(creatorFields(entity.value).map((name) => [name, `You (${session.label})`])) : {})
let loadGeneration = 0
let dialogGeneration = 0

useHead({ title: () => entity.value?.presentation.pluralLabel ?? 'Not found' })

const countText = computed(() => {
  if (loading.value || errorMessage.value || !entity.value || records.value.length === 0) return undefined
  const count = records.value.length
  return `${count} ${count === 1 ? entity.value.presentation.label.toLowerCase() : entity.value.presentation.pluralLabel.toLowerCase()}`
})

async function load() {
  const current = entity.value
  const generation = ++loadGeneration
  closeDialog(true)
  query.value = ''
  if (!current || !canList.value || !session.known || needsSignIn.value) {
    records.value = []
    loading.value = false
    errorMessage.value = null
    return
  }
  loading.value = true
  errorMessage.value = null
  try {
    const next = await client.list<BeverRecord>(current.routeName)
    if (generation === loadGeneration && current === entity.value) records.value = next
  } catch (error) {
    if (generation === loadGeneration) {
      errorMessage.value = requestError(error, current.presentation.pluralLabel.toLowerCase())
      records.value = []
    }
  } finally {
    if (generation === loadGeneration) loading.value = false
  }
}
watch([entityRoute, () => session.known, () => session.label], load)
onMounted(async () => {
  await load()
  if (route.query.create) {
    void router.replace({ query: {} })
    openCreate()
  }
})

function openCreate() {
  const current = entity.value
  if (!current || !createAction.value) return
  if (current.presentation.creating.mode === 'Page') return void router.push(`/${entityRoute.value}/new`)
  if (current.presentation.creating.mode !== 'Modal') return
  formValue.value = seedExperience(current, current.presentation.creating) ?? {}
  serverErrors.value = {}
  dialogRecord.value = null
  dialog.value = 'create'
}

function view(record: BeverRecord) {
  const id = recordId(record)
  if (id) void router.push(`/${entityRoute.value}/${encodeURIComponent(id)}`)
}

function edit(record: BeverRecord) {
  const current = entity.value
  const id = recordId(record)
  if (!current || !id || !hasCompleteEditContext(current, record)) return
  if (current.presentation.editing.mode === 'Page') {
    retainEditContext(current.routeName, id, record)
    return void router.push(`/${entityRoute.value}/${encodeURIComponent(id)}/edit`)
  }
  if (current.presentation.editing.mode !== 'Modal') return
  const seed = seedExperience(current, current.presentation.editing, record)
  if (!seed) return
  dialogRecord.value = record
  formValue.value = seed
  serverErrors.value = {}
  dialog.value = 'edit'
}

function closeDialog(force = false) {
  if (submitting.value && !force) return
  dialogGeneration++
  dialog.value = null
  dialogRecord.value = null
  formValue.value = {}
  serverErrors.value = {}
  if (force) submitting.value = false
}

async function submitDialog() {
  const current = entity.value
  const kind = dialog.value
  const action = kind === 'create' ? createAction.value : updateAction.value
  if (!current || !kind || !action || submitting.value) return
  if (action.confirm && !await confirm({ title: action.label, description: action.confirm, action: action.label })) return
  const generation = ++dialogGeneration
  submitting.value = true
  serverErrors.value = {}
  try {
    if (kind === 'create') {
      const created = await client.create<BeverRecord>(current.routeName, experiencePayload(current, current.presentation.creating, formValue.value))
      if (generation !== dialogGeneration) return
      records.value = [created, ...records.value]
      toast.success(`${current.presentation.label} created`)
    } else {
      const previous = dialogRecord.value!
      const initial = seedExperience(current, current.presentation.editing, previous)!
      const payload = changedPayload(current, current.presentation.editing, initial, formValue.value)
      if (Object.keys(payload).length > 0) {
        const next = await client.patch<BeverRecord>(current.routeName, recordId(previous)!, payload)
        if (generation !== dialogGeneration) return
        reconcile(previous, next)
        toast.success(`${current.presentation.label} updated`)
      }
    }
    submitting.value = false
    closeDialog()
  } catch (error) {
    if (generation !== dialogGeneration) return
    serverErrors.value = fieldErrors(error)
    if (Object.keys(serverErrors.value).length === 0) toast.error(requestError(error, current.presentation.label.toLowerCase()))
  } finally {
    if (generation === dialogGeneration) submitting.value = false
  }
}

async function remove(record: BeverRecord) {
  const current = entity.value
  const id = recordId(record)
  if (!current || !id) return
  const label = recordLabel(current, record)
  const confirmed = await confirm({
    title: `Delete ${label === current.presentation.label ? `this ${current.presentation.label.toLowerCase()}` : `“${label}”`}?`,
    description: deleteAction.value?.confirm === 'Delete this record?' ? 'This cannot be undone.' : deleteAction.value?.confirm ?? undefined,
    action: deleteAction.value?.label ?? 'Delete',
    destructive: true,
  })
  if (!confirmed) return
  try {
    await client.delete(current.routeName, id)
    records.value = records.value.filter((item) => item !== record)
    toast.success(`${current.presentation.label} deleted`)
  } catch (error) {
    toast.error(requestError(error, current.presentation.label.toLowerCase()))
  }
}

function reconcile(previous: BeverRecord, next: BeverRecord) {
  const index = records.value.indexOf(previous)
  if (index >= 0) records.value.splice(index, 1, next)
}

function saveInline(id: string, payload: Record<string, unknown>) {
  return client.patch<BeverRecord>(entity.value!.routeName, id, payload)
}
</script>

<template>
  <div>
    <div v-if="entity && needsSignIn" class="flex min-h-[60svh] items-center justify-center">
      <SignInPanel :reason="`Sign in to see ${entity.presentation.pluralLabel.toLowerCase()}.`" />
    </div>

    <template v-else-if="entity">
      <PageHeader :title="entity.presentation.pluralLabel" :description="countText">
        <Button v-if="createAction" :variant="createAction.emphasis === 'Default' ? 'outline' : 'default'" @click="openCreate">
          <PlusIcon data-icon="inline-start" />{{ createLabel(entity, createAction) }}
        </Button>
      </PageHeader>

      <div v-if="loading || !session.known" class="overflow-hidden rounded-xl border">
        <div class="h-10 border-b bg-muted/40" />
        <div v-for="index in 5" :key="index" class="flex gap-6 border-b px-4 py-4 last:border-0">
          <Skeleton class="h-4 w-1/3" /><Skeleton class="h-4 w-1/4" /><Skeleton class="h-4 w-1/6" />
        </div>
      </div>
      <StatePanel v-else-if="!canList" :icon="CompassIcon" :title="`${entity.presentation.pluralLabel} cannot be listed`" description="This model lets people change these records but not browse them." />
      <StatePanel v-else-if="errorMessage" :icon="CircleAlertIcon" :title="`Could not load ${entity.presentation.pluralLabel.toLowerCase()}`" :description="errorMessage">
        <Button variant="outline" @click="load">Try again</Button>
      </StatePanel>
      <StatePanel v-else-if="records.length === 0" :icon="InboxIcon" :title="`No ${entity.presentation.pluralLabel.toLowerCase()} yet`" :description="createAction ? `Create the first ${entity.presentation.label.toLowerCase()} to get started.` : `There are no ${entity.presentation.pluralLabel.toLowerCase()} to show.`">
        <Button v-if="createAction" @click="openCreate"><PlusIcon data-icon="inline-start" />{{ createLabel(entity, createAction) }}</Button>
      </StatePanel>
      <template v-else>
        <div class="relative mb-4 max-w-sm">
          <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="query" type="search" :placeholder="`Search ${entity.presentation.pluralLabel.toLowerCase()}`" :aria-label="`Search ${entity.presentation.pluralLabel.toLowerCase()}`" class="pl-8" />
        </div>
        <RecordTable
          :entity="entity" :records="records" :context-key="entityRoute" :query="query" :save-inline="saveInline"
          @view="view" @edit="edit" @delete="remove" @reconciled="reconcile" @clear-query="query = ''"
        />
      </template>
    </template>

    <StatePanel v-else :icon="CompassIcon" title="Page not found" :description="`There is no page called “${entityRoute}”.`">
      <Button as-child variant="outline"><NuxtLink to="/">Go home</NuxtLink></Button>
    </StatePanel>

    <Dialog :open="dialog !== null" @update:open="(open) => { if (!open) closeDialog() }">
      <DialogContent v-if="entity && dialog" class="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ dialog === 'create' ? createLabel(entity, createAction) : `Edit ${recordLabel(entity, dialogRecord!)}` }}</DialogTitle>
          <DialogDescription>{{ dialog === 'create' ? `Fill in the details of the new ${entity.presentation.label.toLowerCase()}.` : 'Change the details and save.' }}</DialogDescription>
        </DialogHeader>
        <DynamicForm
          v-model="formValue" :entity="entity"
          :experience="dialog === 'create' ? entity.presentation.creating : entity.presentation.editing"
          :labels="dialog === 'edit' ? dialogRecord?._labels : undefined"
          :identity-context="{ entityRoute: entity.routeName, action: dialog === 'create' ? 'Create' : 'Update', ...(dialog === 'edit' ? { id: recordId(dialogRecord)! } : {}) }"
          :server-errors="serverErrors" :submitting="submitting"
          :fixed="dialog === 'create' ? creatorFixed : undefined"
          :submit-label="dialog === 'create' ? (createAction?.label === 'Create' ? `Create ${entity.presentation.label.toLowerCase()}` : createAction?.label) : (updateAction?.label === 'Edit' ? 'Save changes' : updateAction?.label)"
          @submit="submitDialog" @cancel="closeDialog()"
        />
      </DialogContent>
    </Dialog>
  </div>
</template>
