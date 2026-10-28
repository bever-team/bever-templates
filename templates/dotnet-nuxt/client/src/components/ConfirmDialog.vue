<script setup lang="ts">
import { confirmation, settleConfirmation } from '@/bever/confirm'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Closing also fires for the confirm button itself, so a close settles as "cancel" only after the button's click.
function onOpenChange(open: boolean) {
  if (!open) setTimeout(() => settleConfirmation(false))
}
</script>

<template>
  <AlertDialog :open="confirmation.open" @update:open="onOpenChange">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ confirmation.title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="confirmation.description">{{ confirmation.description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="settleConfirmation(false)">Cancel</AlertDialogCancel>
        <AlertDialogAction :class="confirmation.destructive ? 'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40' : undefined" @click="settleConfirmation(true)">
          {{ confirmation.action }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
