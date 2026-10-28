import { humanize } from '@bever/sdk'
import type { FieldModel } from '@bever/sdk'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })
const moneyFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 10 })

// A value as people read it: localized numbers and dates, readable enum names, Yes/No.
export function formatValue(field: FieldModel, value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const type = field.type
  if (type?.kind === 'Enum') return humanize(String(value))
  switch (type?.name) {
    case 'Boolean': return value ? 'Yes' : 'No'
    case 'Money': return typeof value === 'number' ? moneyFormat.format(value) : String(value)
    case 'Int':
    case 'Decimal': return typeof value === 'number' ? numberFormat.format(value) : String(value)
    case 'Date': return formatDate(String(value))
    case 'DateTime': return formatDateTime(String(value))
    case 'Time': {
      const [hours, minutes] = String(value).split(':').map(Number)
      return hours === undefined || minutes === undefined ? String(value) : timeFormat.format(new Date(2000, 0, 1, hours, minutes))
    }
    default: return String(value)
  }
}

export function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return year && month && day ? dateFormat.format(new Date(year, month - 1, day)) : value
}

export function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateTimeFormat.format(date)
}

const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const relativeUnits: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]]

// "3 minutes ago" or "yesterday" within a week, otherwise a date.
export function formatRelative(value: unknown): string {
  if (typeof value !== 'string') return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const seconds = (date.getTime() - Date.now()) / 1000
  if (Math.abs(seconds) >= 7 * 86400) return dateFormat.format(date)
  const [unit, size] = relativeUnits.find(([, size]) => Math.abs(seconds) >= size) ?? ['second', 1]
  return relativeFormat.format(Math.round(seconds / size), unit)
}

// Text that searching and sorting compare, matching what the table shows.
export function sortKey(field: FieldModel, value: unknown): string | number {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  return field.type?.kind === 'Enum' ? (field.type.options.findIndex((option) => option.name === value) + 1) : String(value).toLowerCase()
}
