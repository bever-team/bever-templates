<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { CompassIcon } from '@lucide/vue'
import type { BeverRecord, ResolvedInputExperiencePresentation } from '@bever/sdk'
import { useBeverClient } from '@/bever/model'
import { findEntityByRoute } from '@/bever/useEntity'
import { takeEditContext } from '@/bever/editContext'
import { actionAt, changedPayload, createLabel, creatorFields, experiencePayload, hasCompleteEditContext, recordLabel, seedExperience, type ActionPlacement } from '@/bever/presentation'
import { confirm } from '@/bever/confirm'
import { recordId } from '@/bever/records'
import { fieldErrors, requestError, session } from '@/bever/session'
import DynamicForm from '@/components/DynamicForm.vue'
import PageHeader from '@/components/PageHeader.vue'
import SignInPanel from '@/components/SignInPanel.vue'
import StatePanel from '@/components/StatePanel.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const props = defineProps<{ mode: 'create' | 'edit' }>()
const route = useRoute()
const router = useRouter()
const client = useBeverClient()
const entityRoute = computed(() => String(route.params.entityRoute ?? ''))
const id = computed(() => route.params.id ? String(route.params.id) : undefined)
const entity = computed(() => findEntityByRoute(entityRoute.value))
const experience = computed<ResolvedInputExperiencePresentation | undefined>(() => entity.value?.presentation[props.mode === 'create' ? 'creating' : 'editing'])
const routeAction = computed(() => {
  const current = entity.value
  if (!current) return undefined
  return props.mode === 'create' ? actionAt(current, 'Create', 'ListingToolbar') : actionAt(current, 'Update', 'ListingRow') ?? actionAt(current, 'Update', 'DetailsToolbar')
})
const routeAllowed = computed(() => experience.value?.mode === 'Page' && !!routeAction.value)
// The page exists but needs a signed-in visitor: offer sign-in instead of "unavailable".
const needsSignIn = computed(() => {
  const current = entity.value
  if (!current || !session.known || session.label || experience.value?.mode !== 'Page' || routeAction.value) return false
  const verb = props.mode === 'create' ? 'Create' : 'Update'
  const placements: ActionPlacement[] = props.mode === 'create' ? ['ListingToolbar'] : ['ListingRow', 'DetailsToolbar']
  return placements.some((placement) => current.presentation.getActionsForPlacement(placement).some((item) => item.action.verb === verb))
})
const initial = ref<Record<string, unknown>>({})
const formValue = ref<Record<string, unknown>>({})
const labels = ref<Record<string, string | null>>()
const editedLabel = ref('')
const serverErrors = ref<Record<string, string>>({})
const submitting = ref(false)
const contextError = ref(false)
const saved = ref(false)
let submitGeneration = 0

const backTo = computed(() => props.mode === 'edit' && id.value ? `/${entityRoute.value}/${encodeURIComponent(id.value)}` : `/${entityRoute.value}`)
const title = computed(() => !entity.value ? '' : props.mode === 'create' ? createLabel(entity.value, routeAction.value) : `Edit ${entity.value.presentation.label.toLowerCase()}`)
const crumbs = computed(() => !entity.value ? [] : [
  { label: entity.value.presentation.pluralLabel, to: `/${entity.value.routeName}` },
  ...(props.mode === 'edit' && editedLabel.value && actionAt(entity.value, 'Read', 'ListingRow') ? [{ label: editedLabel.value, to: backTo.value }] : []),
])
const creatorFixed = computed(() => entity.value ? Object.fromEntries(creatorFields(entity.value).map((name) => [name, `You (${session.label})`])) : {})
const dirty = computed(() => !saved.value && JSON.stringify(formValue.value) !== JSON.stringify(initial.value))
useHead({ title: () => title.value || 'Not found' })

function init() {
  submitGeneration++
  submitting.value = false
  saved.value = false
  contextError.value = false
  serverErrors.value = {}
  labels.value = undefined
  const current = entity.value
  if (!current || !experience.value || !routeAllowed.value) return
  if (props.mode === 'create') {
    initial.value = seedExperience(current, experience.value) ?? {}
    formValue.value = { ...initial.value }
    return
  }
  // Edit values come only from the record the visitor just opened; a bare URL is not enough context.
  const record: BeverRecord | undefined = id.value ? takeEditContext(current.routeName, id.value) : undefined
  const seed = record && hasCompleteEditContext(current, record) ? seedExperience(current, experience.value, record) : undefined
  if (!record || !seed) {
    contextError.value = true
    return
  }
  initial.value = { ...seed }
  formValue.value = { ...seed }
  labels.value = record._labels
  editedLabel.value = recordLabel(current, record)
}
watch([entityRoute, id, routeAllowed], init)
onMounted(init)

// Leaving with unsaved changes asks first.
onBeforeRouteLeave(async () => !dirty.value || await confirm({ title: 'Discard your changes?', description: 'The changes you made will be lost.', action: 'Discard', destructive: true }))
const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.value) event.preventDefault() }
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))

async function submit() {
  const current = entity.value
  const currentExperience = experience.value
  const action = routeAction.value
  if (!current || !currentExperience || !action || !routeAllowed.value || contextError.value || submitting.value) return
  if (action.confirm && !await confirm({ title: action.label, description: action.confirm, action: action.label })) return
  const generation = ++submitGeneration
  submitting.value = true
  serverErrors.value = {}
  try {
    let target = backTo.value
    if (props.mode === 'edit') {
      const payload = changedPayload(current, currentExperience, initial.value, formValue.value)
      if (Object.keys(payload).length > 0) await client.patch(current.routeName, id.value!, payload)
      toast.success(`${current.presentation.label} updated`)
    } else {
      const created = await client.create<BeverRecord>(current.routeName, experiencePayload(current, currentExperience, formValue.value))
      toast.success(`${current.presentation.label} created`)
      if (actionAt(current, 'Read', 'ListingRow') && recordId(created)) target = `/${entityRoute.value}/${encodeURIComponent(recordId(created)!)}`
    }
    if (generation !== submitGeneration) return
    saved.value = true
    await router.push(target)
  } catch (error) {
    if (generation !== submitGeneration) return
    serverErrors.value = fieldErrors(error)
    if (Object.keys(serverErrors.value).length === 0) toast.error(requestError(error, current.presentation.label.toLowerCase()))
  } finally {
    if (generation === submitGeneration) submitting.value = false
  }
}
</script>

<template>
  <div>
    <div v-if="entity && needsSignIn" class="flex min-h-[60svh] items-center justify-center">
      <SignInPanel :reason="`Sign in to ${mode === 'create' ? 'create' : 'edit'} ${mode === 'create' ? entity.presentation.pluralLabel.toLowerCase() : `this ${entity.presentation.label.toLowerCase()}`}.`" />
    </div>
    <div v-else-if="!session.known" />
    <template v-else-if="entity && experience && routeAllowed">
      <PageHeader :title="title" :crumbs="crumbs" />
      <StatePanel v-if="contextError" :icon="CompassIcon" :title="`Open the ${entity.presentation.label.toLowerCase()} first`" :description="`To edit a ${entity.presentation.label.toLowerCase()}, open it and choose Edit.`">
        <Button as-child variant="outline"><NuxtLink :to="backTo">Open {{ entity.presentation.label.toLowerCase() }}</NuxtLink></Button>
      </StatePanel>
      <Card v-else class="max-w-2xl">
        <CardContent>
          <DynamicForm
            v-model="formValue" :entity="entity" :experience="experience" :labels="labels"
            :identity-context="{ entityRoute: entity.routeName, action: mode === 'create' ? 'Create' : 'Update', ...(id ? { id } : {}) }"
            :server-errors="serverErrors" :submitting="submitting" :fixed="mode === 'create' ? creatorFixed : undefined"
            :submit-label="mode === 'create' ? (routeAction?.label === 'Create' ? `Create ${entity.presentation.label.toLowerCase()}` : routeAction?.label) : (routeAction?.label === 'Edit' ? 'Save changes' : routeAction?.label)"
            @submit="submit" @cancel="router.push(backTo)"
          />
        </CardContent>
      </Card>
    </template>
    <StatePanel v-else :icon="CompassIcon" title="Page not found" description="This page is not available.">
      <Button as-child variant="outline"><NuxtLink to="/">Go home</NuxtLink></Button>
    </StatePanel>
  </div>
</template>
