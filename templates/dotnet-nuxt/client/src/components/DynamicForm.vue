<script setup lang="ts">
import { computed, nextTick, reactive, watch } from 'vue'
import { LoaderCircleIcon } from '@lucide/vue'
import type { BeverEntity, IdentityLookupContext, ResolvedInputExperiencePresentation } from '@bever/sdk'
import { describeField, validateValue } from '@/bever/fieldTypes'
import DynamicField from '@/components/DynamicField.vue'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'

// A create or edit form for an experience's fields. Values are checked as people leave each field and
// again on submit; errors the server returns appear under their fields, or above the buttons when the form
// does not show the field (a rule on a field outside this experience).
const props = defineProps<{
  entity: BeverEntity
  modelValue: Record<string, unknown>
  experience: ResolvedInputExperiencePresentation
  submitLabel?: string
  submitting?: boolean
  identityContext?: Omit<IdentityLookupContext, 'field'>
  // Labels of the edited record's references (`_labels`), so pickers can show the current selection.
  labels?: Record<string, string | null>
  // Server validation errors keyed by request field name.
  serverErrors?: Record<string, string>
  compact?: boolean
  // Fields the form fills in and shows as fixed text, by field name (for example the creator as owner).
  fixed?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, unknown>): void
  (e: 'submit'): void
  (e: 'cancel'): void
}>()

const formId = `form-${Math.random().toString(36).slice(2, 8)}`
const fields = computed(() => props.experience.fields.map(({ field, label }) => ({
  ...describeField(field, label),
  requestName: props.entity.getRequestFieldName(field),
  picker: props.experience.inputs.find((input) => input.field.name === field.name),
})))
const touched = reactive(new Set<string>())
const clientErrors = computed(() => Object.fromEntries(fields.value.map((item) => [item.name, validateValue(item, props.modelValue[item.name])])))
const errorFor = (item: (typeof fields.value)[number]) =>
  (touched.has(item.name) ? clientErrors.value[item.name] : undefined) ?? props.serverErrors?.[item.requestName]

const otherErrors = computed(() => Object.entries(props.serverErrors ?? {})
  .filter(([name]) => !fields.value.some((item) => item.requestName === name))
  .map(([, message]) => message))

watch(() => props.serverErrors, (errors) => { if (errors && Object.keys(errors).length > 0) void focusFirstError() })

function update(name: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [name]: value })
}

async function submit() {
  for (const item of fields.value) touched.add(item.name)
  if (fields.value.some((item) => clientErrors.value[item.name])) return void focusFirstError()
  emit('submit')
}

async function focusFirstError() {
  await nextTick()
  document.querySelector<HTMLElement>(`#${formId} [aria-invalid="true"]`)?.focus()
}

const hint = (item: (typeof fields.value)[number]) => item.kind === 'textarea' && item.maxLength ? `Up to ${item.maxLength} characters.` : undefined
</script>

<template>
  <form :id="formId" novalidate @submit.prevent="submit">
    <div :class="compact ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-6'">
      <Field v-for="item in fields" :key="item.name" :class="compact && item.kind === 'textarea' && 'sm:col-span-2 lg:col-span-3'" :data-invalid="!!errorFor(item) || undefined">
        <FieldLabel :for="`${formId}-${item.name}`">
          {{ item.label }}
          <span v-if="!item.required && item.kind !== 'boolean'" class="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <p v-if="fixed?.[item.name] !== undefined" :id="`${formId}-${item.name}`" class="flex h-8 items-center text-sm">{{ fixed[item.name] }}</p>
        <DynamicField
          v-else
          :id="`${formId}-${item.name}`"
          :descriptor="item"
          :model-value="modelValue[item.name]"
          :invalid="!!errorFor(item)"
          :described-by="errorFor(item) ? `${formId}-${item.name}-error` : undefined"
          :picker="item.picker"
          :identity-context="identityContext ? { ...identityContext, field: item.requestName } : undefined"
          :current-label="labels?.[item.requestName]"
          @update:model-value="(value: unknown) => update(item.name, value)"
          @blur="touched.add(item.name)"
        />
        <FieldError v-if="errorFor(item)" :id="`${formId}-${item.name}-error`">{{ errorFor(item) }}</FieldError>
        <FieldDescription v-else-if="hint(item) && !compact">{{ hint(item) }}</FieldDescription>
      </Field>
    </div>
    <FieldError v-if="otherErrors.length > 0" :class="compact ? 'mt-4' : 'mt-6'">{{ otherErrors.join(' ') }}</FieldError>
    <div :class="['flex items-center gap-2', compact ? 'mt-4' : 'mt-8 border-t pt-6']">
      <Button type="submit" :disabled="submitting">
        <LoaderCircleIcon v-if="submitting" class="animate-spin" data-icon="inline-start" />
        {{ submitLabel ?? 'Save' }}
      </Button>
      <Button type="button" variant="ghost" :disabled="submitting" @click="emit('cancel')">Cancel</Button>
    </div>
  </form>
</template>
