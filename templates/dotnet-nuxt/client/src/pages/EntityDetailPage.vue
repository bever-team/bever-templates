<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { CircleAlertIcon, CompassIcon, PencilIcon, TrashIcon } from '@lucide/vue'
import type { BeverRecord } from '@bever/sdk'
import { useBeverClient } from '@/bever/model'
import { findEntityByRoute } from '@/bever/useEntity'
import { retainEditContext } from '@/bever/editContext'
import { actionAt, actionsAt, canRead, changedPayload, hasCompleteEditContext, readRequiresSignIn, recordLabel, seedExperience } from '@/bever/presentation'
import { confirm } from '@/bever/confirm'
import { formatDateTime, formatRelative } from '@/bever/format'
import { recordId } from '@/bever/records'
import { describeField } from '@/bever/fieldTypes'
import { fieldErrors, requestError, session, usableOn } from '@/bever/session'
import DynamicForm from '@/components/DynamicForm.vue'
import FieldValue from '@/components/FieldValue.vue'
import PageHeader from '@/components/PageHeader.vue'
import SignInPanel from '@/components/SignInPanel.vue'
import StatePanel from '@/components/StatePanel.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

const route = useRoute()
const router = useRouter()
const client = useBeverClient()
const entityRoute = computed(() => String(route.params.entityRoute ?? ''))
const id = computed(() => String(route.params.id ?? ''))
const entity = computed(() => findEntityByRoute(entityRoute.value))
const toolbar = computed(() => entity.value ? actionsAt(entity.value, 'DetailsToolbar') : [])
const updateAction = computed(() => entity.value && actionAt(entity.value, 'Update', 'DetailsToolbar'))
const deleteAction = computed(() => entity.value && actionAt(entity.value, 'Delete', 'DetailsToolbar'))
const needsSignIn = computed(() => session.known && !!entity.value && readRequiresSignIn(entity.value))
const record = ref<BeverRecord | null>(null)
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const editOpen = ref(false)
const initial = ref<Record<string, unknown>>({})
const draft = ref<Record<string, unknown>>({})
const serverErrors = ref<Record<string, string>>({})
const submitting = ref(false)
let generation = 0
const isLongText = (field: Parameters<typeof describeField>[0]) => describeField(field).kind === 'textarea'

const title = computed(() => entity.value && record.value ? recordLabel(entity.value, record.value) : entity.value?.presentation.label ?? '')
const crumbs = computed(() => entity.value && canRead(entity.value) && actionAt(entity.value, 'Read', 'Navigation')
  ? [{ label: entity.value.presentation.pluralLabel, to: `/${entity.value.routeName}` }]
  : [])
useHead({ title: () => title.value || 'Not found' })

async function load() {
  const current = entity.value
  const currentId = id.value
  closeEdit(true)
  const operation = ++generation
  if (!current || !session.known || needsSignIn.value) {
    record.value = null
    errorMessage.value = null
    return
  }
  if (!current.presentation.actions.some((item) => item.action.verb === 'Read')) {
    record.value = null
    errorMessage.value = `${current.presentation.pluralLabel} cannot be opened in this app.`
    return
  }
  loading.value = true
  errorMessage.value = null
  try {
    const next = await client.get<BeverRecord>(current.routeName, currentId)
    if (operation === generation) record.value = next
  } catch (error) {
    if (operation === generation) {
      errorMessage.value = requestError(error, current.presentation.label.toLowerCase())
      record.value = null
    }
  } finally {
    if (operation === generation) loading.value = false
  }
}
watch([entityRoute, id, () => session.known, () => session.label], load)
onMounted(load)

function openEdit() {
  const current = entity.value
  const currentRecord = record.value
  if (!current || !currentRecord || !updateAction.value || !hasCompleteEditContext(current, currentRecord)) return
  if (current.presentation.editing.mode === 'Page') {
    retainEditContext(current.routeName, id.value, currentRecord)
    return void router.push(`/${entityRoute.value}/${encodeURIComponent(id.value)}/edit`)
  }
  const seed = seedExperience(current, current.presentation.editing, currentRecord)
  if (!seed) return
  initial.value = { ...seed }
  draft.value = { ...seed }
  serverErrors.value = {}
  editOpen.value = true
}

function closeEdit(force = false) {
  if (submitting.value && !force) return
  if (force) generation++
  editOpen.value = false
  serverErrors.value = {}
  if (force) submitting.value = false
}

async function saveEdit() {
  const current = entity.value
  const previous = record.value
  const recordKey = recordId(previous)
  if (!current || !previous || !recordKey || submitting.value) return
  const payload = changedPayload(current, current.presentation.editing, initial.value, draft.value)
  if (Object.keys(payload).length === 0) return closeEdit()
  if (updateAction.value?.confirm && !await confirm({ title: updateAction.value.label, description: updateAction.value.confirm, action: updateAction.value.label })) return
  const operation = ++generation
  submitting.value = true
  serverErrors.value = {}
  try {
    const next = await client.patch<BeverRecord>(current.routeName, recordKey, payload)
    if (operation !== generation) return
    record.value = next
    submitting.value = false
    closeEdit()
    toast.success(`${current.presentation.label} updated`)
  } catch (error) {
    if (operation !== generation) return
    serverErrors.value = fieldErrors(error)
    if (Object.keys(serverErrors.value).length === 0) toast.error(requestError(error, current.presentation.label.toLowerCase()))
  } finally {
    if (operation === generation) submitting.value = false
  }
}

async function remove() {
  const current = entity.value
  const currentRecord = record.value
  const recordKey = recordId(currentRecord)
  if (!current || !currentRecord || !recordKey) return
  const confirmed = await confirm({
    title: `Delete “${recordLabel(current, currentRecord)}”?`,
    description: deleteAction.value?.confirm === 'Delete this record?' ? 'This cannot be undone.' : deleteAction.value?.confirm ?? undefined,
    action: deleteAction.value?.label ?? 'Delete',
    destructive: true,
  })
  if (!confirmed) return
  try {
    await client.delete(current.routeName, recordKey)
    toast.success(`${current.presentation.label} deleted`)
    await router.push(crumbs.value[0]?.to ?? '/')
  } catch (error) {
    toast.error(requestError(error, current.presentation.label.toLowerCase()))
  }
}
</script>

<template>
  <div>
    <div v-if="entity && needsSignIn" class="flex min-h-[60svh] items-center justify-center">
      <SignInPanel :reason="`Sign in to see this ${entity.presentation.label.toLowerCase()}.`" />
    </div>

    <template v-else-if="entity">
      <div v-if="loading || !session.known" class="flex flex-col gap-6">
        <Skeleton class="h-4 w-24" />
        <Skeleton class="h-9 w-72" />
        <Skeleton class="h-64 w-full rounded-xl" />
      </div>
      <StatePanel v-else-if="errorMessage" :icon="CircleAlertIcon" :title="`Could not open this ${entity.presentation.label.toLowerCase()}`" :description="errorMessage">
        <Button v-if="crumbs[0]" as-child variant="outline"><NuxtLink :to="crumbs[0].to">Back to {{ entity.presentation.pluralLabel.toLowerCase() }}</NuxtLink></Button>
      </StatePanel>
      <template v-else-if="record">
        <PageHeader :title="title" :crumbs="crumbs">
          <template #meta>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ entity.presentation.label }}
              <template v-if="record.modifiedOn"> · Updated <time :datetime="String(record.modifiedOn)" :title="formatDateTime(String(record.modifiedOn))">{{ formatRelative(record.modifiedOn) }}</time></template>
            </p>
          </template>
          <template v-for="action in toolbar.filter((item) => usableOn(item.action, record!))" :key="action.action.verb">
            <Button v-if="action.action.verb === 'Update' && hasCompleteEditContext(entity, record)" variant="outline" @click="openEdit">
              <PencilIcon data-icon="inline-start" />{{ action.label }}
            </Button>
            <Button v-else-if="action.action.verb === 'Delete'" variant="destructive" @click="remove">
              <TrashIcon data-icon="inline-start" />{{ action.label }}
            </Button>
          </template>
        </PageHeader>
        <Card>
          <CardContent>
            <dl class="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <div v-for="item in entity.presentation.details" :key="item.field.name" :class="['flex flex-col gap-1', isLongText(item.field) && 'sm:col-span-2']">
                <dt class="text-sm text-muted-foreground">{{ item.label }}</dt>
                <dd class="text-sm"><FieldValue :field="item.field" :record="record" detail /></dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </template>
    </template>

    <StatePanel v-else :icon="CompassIcon" title="Page not found" :description="`There is no page called “${entityRoute}”.`">
      <Button as-child variant="outline"><NuxtLink to="/">Go home</NuxtLink></Button>
    </StatePanel>

    <Dialog :open="editOpen" @update:open="(open) => { if (!open) closeEdit() }">
      <DialogContent v-if="entity && record" class="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {{ title }}</DialogTitle>
          <DialogDescription>Change the details and save.</DialogDescription>
        </DialogHeader>
        <DynamicForm
          v-model="draft" :entity="entity" :experience="entity.presentation.editing" :labels="record._labels"
          :identity-context="{ entityRoute: entity.routeName, action: 'Update', id }" :server-errors="serverErrors" :submitting="submitting"
          :submit-label="updateAction?.label === 'Edit' ? 'Save changes' : updateAction?.label" @submit="saveEdit" @cancel="closeEdit()"
        />
      </DialogContent>
    </Dialog>
  </div>
</template>
