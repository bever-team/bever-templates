import type { BeverRecord, FieldModel } from '@bever/sdk'
import { toRequestFieldName } from '@bever/sdk'

// A field value from an API record (the API uses camelCase names).
export function readField(record: BeverRecord, field: FieldModel): unknown {
  return (record as Record<string, unknown>)[toRequestFieldName(field.name)]
}

export function recordId(record: BeverRecord | null | undefined): string | undefined {
  const id = record?.id
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

// The label of a set reference, from the server's `_labels`. A target the visitor may not see shows as
// Unavailable: the generated app never prints a stored ID.
export function referenceLabel(record: BeverRecord, field: FieldModel): string {
  const id = readField(record, field)
  if (id === null || id === undefined || id === '') return ''
  const label = record._labels?.[toRequestFieldName(field.name)]
  return typeof label === 'string' ? label || 'Untitled' : 'Unavailable'
}
