import { reactive } from 'vue'

// One app-wide confirmation dialog (rendered by ConfirmDialog in app.vue).
export const confirmation = reactive({
  open: false,
  title: '',
  description: '',
  action: 'Confirm',
  destructive: false,
  resolve: undefined as ((confirmed: boolean) => void) | undefined,
})

export function confirm(options: { title: string, description?: string, action?: string, destructive?: boolean }): Promise<boolean> {
  confirmation.resolve?.(false)
  return new Promise((resolve) => {
    Object.assign(confirmation, { open: true, description: '', action: 'Confirm', destructive: false, ...options, resolve })
  })
}

export function settleConfirmation(confirmed: boolean) {
  const resolve = confirmation.resolve
  confirmation.open = false
  confirmation.resolve = undefined
  resolve?.(confirmed)
}
