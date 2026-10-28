import type {
  BeverEntity,
  BeverRecord,
  ResolvedActionPresentation,
  ResolvedInputExperiencePresentation,
} from '@bever/sdk'
import { readField, recordId } from './records'
import { session, usable } from './session'
import { coerceValue, describeField } from './fieldTypes'
import { app } from './model'

export type ActionPlacement = 'Navigation' | 'ListingToolbar' | 'ListingRow' | 'DetailsToolbar'

// Controls at a placement that the current visitor could use (see `usable`).
export function actionsAt(entity: BeverEntity, placement: ActionPlacement): ResolvedActionPresentation[] {
  return entity.presentation.getActionsForPlacement(placement).filter((item) => usable(item.action))
}

export function actionAt(entity: BeverEntity, verb: string, placement: ActionPlacement): ResolvedActionPresentation | undefined {
  return actionsAt(entity, placement).find((item) => item.action.verb === verb)
}

export function actionVariant(action: ResolvedActionPresentation | undefined): 'default' | 'destructive' | 'outline' {
  if (action?.emphasis === 'Destructive') return 'destructive'
  if (action?.emphasis === 'Primary') return 'default'
  return 'outline'
}

// "New task" for the default Create label, otherwise the configured label.
export function createLabel(entity: BeverEntity, action: ResolvedActionPresentation | undefined): string {
  return !action || action.label === 'Create' ? `New ${entity.presentation.label.toLowerCase()}` : action.label
}

// Whether the visitor may open records of this entity at all (signed-out visitors only with 'By Anyone').
export function canRead(entity: BeverEntity): boolean {
  return entity.presentation.actions.some((item) => item.action.verb === 'Read' && usable(item.action))
}

// Signed in without a matching role, the request still goes out: grants may allow it, and the server says why not.
export function readRequiresSignIn(entity: BeverEntity): boolean {
  return session.label === null && entity.presentation.actions.some((item) => item.action.verb === 'Read') && !canRead(entity)
}

export function entityByName(name: string): BeverEntity | undefined {
  return app.getEntity(name)
}

// An editor needs every editable value from an authorized response; missing values are never guessed.
export function hasCompleteEditContext(entity: BeverEntity, record: BeverRecord | null | undefined): record is BeverRecord {
  if (!recordId(record)) return false
  return entity.presentation.editing.fields.every(({ field }) =>
    Object.prototype.hasOwnProperty.call(record, entity.getRequestFieldName(field)))
}

// Fields that 'Action Create X By <Field>' requires to hold the creator: when every Create rule is such an owner
// rule, the creator must be that account, so the form fills it in and does not offer a choice.
export function creatorFields(entity: BeverEntity): string[] {
  const rules = entity.presentation.actions.find((item) => item.action.verb === 'Create')?.action.authorizations ?? []
  return rules.length > 0 && rules.every((rule) => rule.kind === 'Path') ? rules.map((rule) => rule.path!.segments[0]!) : []
}

export function seedExperience(entity: BeverEntity, experience: ResolvedInputExperiencePresentation, record?: BeverRecord): Record<string, unknown> | undefined {
  const result: Record<string, unknown> = {}
  const creators = record ? [] : creatorFields(entity)
  for (const { field } of experience.fields) {
    if (record) {
      if (!Object.prototype.hasOwnProperty.call(record, entity.getRequestFieldName(field))) return undefined
      result[field.name] = readField(record, field)
    } else if (creators.includes(field.name)) {
      result[field.name] = session.id
    } else {
      const value = field.defaultValue?.value
      result[field.name] = value ?? (field.type?.kind === 'Primitive' && field.type.name === 'Boolean' ? false : null)
    }
  }
  return result
}

// The fields whose values changed, for one PATCH.
export function changedPayload(entity: BeverEntity, experience: ResolvedInputExperiencePresentation, initial: Record<string, unknown>, draft: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const { field } of experience.fields) {
    const before = coerceValue(describeField(field), initial[field.name])
    const after = coerceValue(describeField(field), draft[field.name])
    if (JSON.stringify(before) !== JSON.stringify(after)) result[entity.getRequestFieldName(field)] = after
  }
  return result
}

export function experiencePayload(entity: BeverEntity, experience: ResolvedInputExperiencePresentation, draft: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const { field } of experience.fields) {
    result[entity.getRequestFieldName(field)] = coerceValue(describeField(field), draft[field.name])
  }
  return result
}

// A record's label, falling back to the entity label (never the record ID).
export function recordLabel(entity: BeverEntity, record: BeverRecord): string {
  const label = entity.presentation.recordLabel
  const value = label.kind === 'Field' ? readField(record, label.field) : undefined
  return value === undefined || value === null || value === '' ? entity.presentation.label : String(value)
}
