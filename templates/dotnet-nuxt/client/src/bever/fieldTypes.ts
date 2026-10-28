import type { EnumOptionModel, FieldModel } from '@bever/sdk'

// How to edit and validate a field, derived only from its semantic type.
export type ControlKind =
  | 'text' | 'textarea' | 'email' | 'phone' | 'url'
  | 'number' | 'boolean' | 'date' | 'datetime' | 'time'
  | 'enum' | 'relationship'

export interface FieldDescriptor {
  field: FieldModel
  name: string
  label: string
  kind: ControlKind
  required: boolean
  maxLength?: number
  step?: string
  enumOptions: EnumOptionModel[]
}

// Longer text gets a multi-line box.
const TEXTAREA_FROM_LENGTH = 256

export function describeField(field: FieldModel, label = field.name): FieldDescriptor {
  const type = field.type
  const base = { field, name: field.name, label, enumOptions: [] as EnumOptionModel[], required: !!type && !type.nullable }
  if (!type) return { ...base, kind: 'text' }
  if (type.kind === 'Enum') return { ...base, kind: 'enum', enumOptions: type.options ?? [] }
  if (type.kind === 'Relationship') return { ...base, kind: 'relationship' }

  const maxLength = type.arguments?.map((argument) => argument.maxLength).find((value) => typeof value === 'number') as number | undefined
  switch (type.name) {
    case 'Boolean': return { ...base, kind: 'boolean', required: false }
    case 'Int': return { ...base, kind: 'number', step: '1' }
    case 'Decimal': return { ...base, kind: 'number', step: 'any' }
    case 'Money': return { ...base, kind: 'number', step: '0.01' }
    case 'Date': return { ...base, kind: 'date' }
    case 'DateTime': return { ...base, kind: 'datetime' }
    case 'Time': return { ...base, kind: 'time' }
    case 'Email': return { ...base, kind: 'email' }
    case 'Phone': return { ...base, kind: 'phone' }
    case 'Url': return { ...base, kind: 'url' }
    default: return { ...base, kind: maxLength === undefined || maxLength >= TEXTAREA_FROM_LENGTH ? 'textarea' : 'text', maxLength }
  }
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

// Form values hold API values (strings, numbers, booleans, IDs); empty inputs become null.
export function coerceValue(descriptor: FieldDescriptor, value: unknown): unknown {
  if (descriptor.kind === 'boolean') return Boolean(value)
  if (isEmpty(value)) return descriptor.required && typeof value === 'string' ? value : null
  if (descriptor.kind === 'number') {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isNaN(parsed) ? value : parsed
  }
  return typeof value === 'string' && descriptor.kind !== 'textarea' ? value.trim() : value
}

// The same rules the server applies, checked before sending so people see problems at once.
export function validateValue(descriptor: FieldDescriptor, value: unknown): string | undefined {
  if (descriptor.kind === 'boolean') return undefined
  if (isEmpty(value)) return descriptor.required ? 'This field is required.' : undefined
  const text = String(value).trim()
  if (descriptor.maxLength !== undefined && String(value).length > descriptor.maxLength) return `Use at most ${descriptor.maxLength} characters.`
  switch (descriptor.kind) {
    case 'number': {
      const number = Number(value)
      if (Number.isNaN(number)) return 'Enter a number.'
      if (descriptor.step === '1' && !Number.isInteger(number)) return 'Enter a whole number.'
      return undefined
    }
    case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? undefined : 'Enter a valid email address.'
    case 'url': return /^https?:\/\/[^\s/]+/i.test(text) ? undefined : 'Enter a full web address starting with http:// or https://.'
    case 'phone': return /^\+?[0-9 ().-]+$/.test(text) && text.replace(/\D/g, '').length >= 3 ? undefined : 'Enter a valid phone number.'
    default: return undefined
  }
}

// A date-time input shows local time; the API stores UTC.
export function toLocalDateTimeInput(value: unknown): string {
  if (typeof value !== 'string' || value === '') return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (number: number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromLocalDateTimeInput(value: string): string | null {
  if (value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
