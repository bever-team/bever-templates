<script setup lang="ts">
import { EllipsisIcon, EyeIcon, PencilIcon, TrashIcon } from '@lucide/vue'
import type { ResolvedActionPresentation } from '@bever/sdk'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// The "…" menu of a record's actions.
defineProps<{ actions: ResolvedActionPresentation[], label: string, disabled?: boolean }>()
const emit = defineEmits<{ (e: 'run', action: ResolvedActionPresentation): void }>()
const icons = { Read: EyeIcon, Update: PencilIcon, Delete: TrashIcon } as Record<string, unknown>
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon-sm" :aria-label="`Actions for ${label}`" :disabled="disabled || actions.length === 0" @click.stop>
        <EllipsisIcon />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-40">
      <template v-for="(action, index) in actions" :key="action.action.verb">
        <DropdownMenuSeparator v-if="action.action.verb === 'Delete' && index > 0" />
        <DropdownMenuItem :variant="action.action.verb === 'Delete' ? 'destructive' : 'default'" @select="emit('run', action)">
          <component :is="icons[action.action.verb]" />
          {{ action.label }}
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
