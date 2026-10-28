<script setup lang="ts">
import { watch } from 'vue'
import { session } from '@/bever/session'
import SignInPanel from '@/components/SignInPanel.vue'

const route = useRoute()
// Only same-site paths, so a crafted link cannot send people elsewhere after signing in.
const redirect = () => {
  const target = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  return target.startsWith('/') && !target.startsWith('//') ? target : '/'
}
watch(() => session.known && session.label, (signedIn) => { if (signedIn) void navigateTo(redirect(), { replace: true }) }, { immediate: true })
useHead({ title: 'Sign in' })
</script>

<template>
  <div class="flex min-h-[70svh] items-center justify-center py-10">
    <SignInPanel v-if="session.known && !session.label" />
  </div>
</template>
