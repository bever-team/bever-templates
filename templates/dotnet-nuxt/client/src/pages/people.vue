<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { CircleAlertIcon, LockIcon, SearchIcon, UsersIcon } from '@lucide/vue'
import { humanize, type IdentityAccount } from '@bever/sdk'
import { model, useBeverClient } from '@/bever/model'
import { requestError, session } from '@/bever/session'
import PageHeader from '@/components/PageHeader.vue'
import SignInPanel from '@/components/SignInPanel.vue'
import StatePanel from '@/components/StatePanel.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'

// Administrators assign the model's roles to accounts. The path does not end in "s", so it never
// collides with an entity route, which is always a plural.
const client = useBeverClient()
const appName = useRuntimeConfig().public.appName as string
const roles = model.roles.map((role) => role.name)
const accounts = ref<IdentityAccount[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(false)
const loadingMore = ref(false)
const errorMessage = ref<string | null>(null)
const search = ref('')
// The search the shown list answers, so typing never relabels results that are still loading.
const listedSearch = ref('')
const saving = ref(new Set<string>())
let generation = 0
let debounce: ReturnType<typeof setTimeout> | undefined

useHead({ title: 'People' })

const canManage = () => session.administrator && roles.length > 0

async function load(more = false) {
  const current = ++generation
  if (!more) {
    accounts.value = []
    nextCursor.value = null
    errorMessage.value = null
  }
  if (!session.known || !canManage()) return
  if (more) loadingMore.value = true
  else loading.value = true
  try {
    const text = search.value.trim()
    const page = await client.listAccounts!({ ...(text ? { search: text } : {}), ...(more && nextCursor.value ? { cursor: nextCursor.value } : {}) })
    if (current !== generation) return
    accounts.value = more ? [...accounts.value, ...page.items] : page.items
    nextCursor.value = page.nextCursor
    listedSearch.value = text
  } catch (error) {
    if (current !== generation) return
    if (more) toast.error(requestError(error, 'people'))
    else errorMessage.value = requestError(error, 'people')
  } finally {
    if (current === generation) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

watch(() => [session.known, session.administrator], () => load())
watch(search, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => { void load() }, 250)
})
onMounted(() => load())

// One save per account at a time; the server's answer replaces the row.
async function toggle(account: IdentityAccount, role: string, on: boolean) {
  if (saving.value.has(account.id)) return
  saving.value.add(account.id)
  try {
    const updated = await client.setAccountRoles!(account.id, roles.filter((name) => name === role ? on : account.roles.includes(name)))
    const index = accounts.value.findIndex((item) => item.id === account.id)
    if (index >= 0) accounts.value.splice(index, 1, updated)
    toast.success(on ? `Assigned ${humanize(role)} to ${account.label}` : `Removed ${humanize(role)} from ${account.label}`)
  } catch (error) {
    toast.error(requestError(error, 'account'))
  } finally {
    saving.value.delete(account.id)
  }
}
</script>

<template>
  <div>
    <div v-if="session.known && !session.label" class="flex min-h-[60svh] items-center justify-center">
      <SignInPanel reason="Sign in to manage people." />
    </div>

    <template v-else>
      <PageHeader title="People" :description="`Choose the roles of the people who use ${appName}.`" />

      <div v-if="!session.known" class="h-64 rounded-xl border" />
      <StatePanel v-else-if="!canManage()" :icon="LockIcon" title="Only Administrators manage people" description="Ask an Administrator if you need a different role." />
      <template v-else>
        <div class="relative mb-4 max-w-sm">
          <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="search" type="search" maxlength="200" placeholder="Search by email" aria-label="Search people by email" class="pl-8" />
        </div>

        <div v-if="loading" class="overflow-hidden rounded-xl border">
          <div v-for="index in 4" :key="index" class="flex items-center justify-between gap-6 border-b px-4 py-4 last:border-0">
            <Skeleton class="h-4 w-1/3" /><Skeleton class="h-4 w-1/4" />
          </div>
        </div>
        <StatePanel v-else-if="errorMessage" :icon="CircleAlertIcon" title="Could not load people" :description="errorMessage">
          <Button variant="outline" @click="load()">Try again</Button>
        </StatePanel>
        <StatePanel v-else-if="accounts.length === 0" :icon="UsersIcon" :title="listedSearch ? 'No one matches' : 'No accounts yet'" :description="listedSearch ? 'Try another part of the email address.' : 'People appear here once they have an account.'" />
        <template v-else>
          <ul class="divide-y overflow-hidden rounded-xl border">
            <li v-for="account in accounts" :key="account.id" class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex min-w-0 flex-wrap items-center gap-2">
                <span class="truncate font-medium">{{ account.label }}</span>
                <span v-if="account.id === session.id" class="text-sm text-muted-foreground">(you)</span>
                <Badge v-if="account.administrator" variant="secondary">Administrator</Badge>
              </div>
              <div role="group" :aria-label="`Roles of ${account.label}`" class="flex flex-wrap gap-x-5 gap-y-2">
                <label v-for="role in roles" :key="role" class="flex items-center gap-2 text-sm">
                  <Switch :model-value="account.roles.includes(role)" :disabled="saving.has(account.id)" @update:model-value="(on: boolean) => toggle(account, role, on)" />
                  {{ humanize(role) }}
                </label>
              </div>
            </li>
          </ul>
          <div v-if="nextCursor" class="mt-4 flex justify-center">
            <Button variant="outline" :disabled="loadingMore" @click="load(true)">Load more</Button>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>
