<script setup lang="ts">
import { computed, ref } from 'vue'
import { BeverHttpError } from '@bever/sdk'
import { toast } from 'vue-sonner'
import { LoaderCircleIcon } from '@lucide/vue'
import { model, useBeverClient } from '@/bever/model'
import { applySession, session } from '@/bever/session'
import AppMark from '@/components/AppMark.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

// Sign in, or create an account when the model enables registration.
const props = defineProps<{ reason?: string }>()
const emit = defineEmits<{ (e: 'signed-in'): void }>()

const appName = useRuntimeConfig().public.appName as string
const canRegister = model.identity.capabilities.includes('Register')
const mode = ref<'sign-in' | 'register'>('sign-in')
const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)
const registering = computed(() => mode.value === 'register')

function toggleMode() {
  mode.value = registering.value ? 'sign-in' : 'register'
  error.value = null
}

async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = null
  try {
    const client = useBeverClient()
    const credentials = { email: email.value.trim(), password: password.value }
    if (registering.value && password.value.length < 8) {
      error.value = 'Use a password of at least 8 characters.'
      return
    }
    const result = registering.value ? await client.register!(credentials) : await client.login!(credentials)
    applySession(result)
    password.value = ''
    toast.success(registering.value ? 'Account created' : `Signed in as ${session.label}`)
    emit('signed-in')
  } catch (cause) {
    error.value = message(cause)
  } finally {
    busy.value = false
  }
}

function message(cause: unknown): string {
  if (!(cause instanceof BeverHttpError)) return 'Could not reach the server. Check your connection and try again.'
  if (cause.status === 429) return 'Too many attempts. Wait a minute and try again.'
  if (registering.value) {
    if (cause.status === 409) return 'An account with this email already exists. Sign in instead.'
    const detail = (cause.body as { error?: { message?: string } } | null)?.error?.message
    return detail && detail !== 'The request is invalid.' ? detail : 'Check the email address and password.'
  }
  return 'The email or password is incorrect.'
}
</script>

<template>
  <Card class="mx-auto w-full max-w-sm">
    <CardHeader class="items-center text-center">
      <AppMark :name="appName" class="mx-auto mb-2 size-10 text-base" />
      <CardTitle class="text-xl">{{ registering ? 'Create your account' : `Sign in to ${appName}` }}</CardTitle>
      <CardDescription>{{ registering ? 'Enter your email address and choose a password.' : props.reason ?? 'Welcome back.' }}</CardDescription>
    </CardHeader>
    <CardContent>
      <form novalidate @submit.prevent="submit">
        <FieldGroup>
          <Field>
            <FieldLabel for="sign-in-email">Email</FieldLabel>
            <Input id="sign-in-email" v-model="email" type="email" autocomplete="email" required autofocus placeholder="you@example.com" />
          </Field>
          <Field>
            <FieldLabel for="sign-in-password">Password</FieldLabel>
            <Input id="sign-in-password" v-model="password" type="password" :autocomplete="registering ? 'new-password' : 'current-password'" required />
            <FieldDescription v-if="registering">At least 8 characters.</FieldDescription>
          </Field>
          <p v-if="error" role="alert" class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{{ error }}</p>
          <Button type="submit" class="w-full" size="lg" :disabled="busy || !email || !password">
            <LoaderCircleIcon v-if="busy" class="animate-spin" data-icon="inline-start" />
            {{ registering ? 'Create account' : 'Sign in' }}
          </Button>
        </FieldGroup>
      </form>
    </CardContent>
    <CardFooter v-if="canRegister" class="justify-center text-sm text-muted-foreground">
      {{ registering ? 'Already have an account?' : 'New here?' }}
      <Button variant="link" class="h-auto px-1" @click="toggleMode">{{ registering ? 'Sign in' : 'Create an account' }}</Button>
    </CardFooter>
  </Card>
</template>
