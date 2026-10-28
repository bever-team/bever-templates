<script setup lang="ts">
import { computed } from 'vue'
import { humanize } from '@bever/sdk'
import type { IdentityLookupContext, ResolvedInputPresentation } from '@bever/sdk'
import type { FieldDescriptor } from '@/bever/fieldTypes'
import { fromLocalDateTimeInput, toLocalDateTimeInput } from '@/bever/fieldTypes'
import ReferencePicker from '@/components/ReferencePicker.vue'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

// One input, chosen by the field's type.
const props = defineProps<{
  id: string
  descriptor: FieldDescriptor
  modelValue: unknown
  invalid?: boolean
  describedBy?: string
  picker?: ResolvedInputPresentation
  identityContext?: IdentityLookupContext
  currentLabel?: string | null
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: unknown): void, (e: 'blur'): void }>()

const NONE = '__none__'
const text = computed<string>({
  get: () => props.modelValue === null || props.modelValue === undefined ? '' : String(props.modelValue),
  set: (next) => emit('update:modelValue', next),
})
const dateTime = computed<string>({
  get: () => toLocalDateTimeInput(props.modelValue),
  set: (next) => emit('update:modelValue', fromLocalDateTimeInput(next)),
})
const option = computed<string>({
  get: () => props.modelValue === null || props.modelValue === undefined || props.modelValue === '' ? (props.descriptor.required ? '' : NONE) : String(props.modelValue),
  set: (next) => emit('update:modelValue', next === NONE ? null : next),
})
const inputType = computed(() => ({ email: 'email', phone: 'tel', url: 'url', number: 'number', date: 'date', time: 'time' } as Record<string, string>)[props.descriptor.kind] ?? 'text')
const inputMode = computed(() => props.descriptor.kind === 'number' ? (props.descriptor.step === '1' ? 'numeric' : 'decimal') : undefined)
const placeholder = computed(() => ({ email: 'name@example.com', url: 'https://', phone: '+1 555 0100' } as Record<string, string>)[props.descriptor.kind])
const attrs = computed(() => ({ 'id': props.id, 'aria-invalid': props.invalid || undefined, 'aria-describedby': props.describedBy }))
</script>

<template>
  <ReferencePicker
    v-if="descriptor.kind === 'relationship' && picker"
    v-bind="attrs" :picker="picker" :model-value="modelValue" :required="descriptor.required" :label="descriptor.label"
    :identity-context="identityContext" :current-label="currentLabel"
    @update:model-value="(next: string | null) => emit('update:modelValue', next)" @blur="emit('blur')"
  />
  <p v-else-if="descriptor.kind === 'relationship'" role="alert" class="text-sm text-destructive">
    You cannot choose a {{ descriptor.label.toLowerCase() }} here.
  </p>
  <div v-else-if="descriptor.kind === 'boolean'" class="flex h-8 items-center">
    <Switch v-bind="attrs" :model-value="Boolean(modelValue)" @update:model-value="(value: boolean) => emit('update:modelValue', value)" />
  </div>
  <Select v-else-if="descriptor.kind === 'enum'" v-model="option" @update:open="(open: boolean) => { if (!open) emit('blur') }">
    <SelectTrigger v-bind="attrs" class="w-full">
      <!-- The label is rendered here, not looked up from the options, so it never flickers while the list closes. -->
      <SelectValue>
        <span v-if="option === ''" class="text-muted-foreground">Choose {{ descriptor.label.toLowerCase() }}</span>
        <span v-else-if="option === NONE" class="text-muted-foreground">None</span>
        <template v-else>{{ humanize(option) }}</template>
      </SelectValue>
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-if="!descriptor.required" :value="NONE" class="text-muted-foreground">None</SelectItem>
      <SelectItem v-for="item in descriptor.enumOptions" :key="item.name" :value="item.name">{{ humanize(item.name) }}</SelectItem>
    </SelectContent>
  </Select>
  <Textarea v-else-if="descriptor.kind === 'textarea'" v-bind="attrs" v-model="text" :maxlength="descriptor.maxLength" rows="4" class="min-h-24" @blur="emit('blur')" />
  <Input v-else-if="descriptor.kind === 'datetime'" v-bind="attrs" v-model="dateTime" type="datetime-local" @blur="emit('blur')" />
  <Input
    v-else v-bind="attrs" v-model="text" :type="inputType" :inputmode="inputMode" :step="descriptor.step"
    :maxlength="descriptor.maxLength" :placeholder="placeholder" :autocomplete="descriptor.kind === 'email' ? 'email' : 'off'" @blur="emit('blur')"
  />
</template>
