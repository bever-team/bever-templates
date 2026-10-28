import { reactive } from 'vue'
import { BeverHttpError, toRequestFieldName, type ActionModel, type AuthorizationModel, type BeverRecord, type IdentitySession } from '@bever/sdk'
import { model } from './model'

// Who is signed in, shared by the shell and pages. `known` stays false until the first session check
// finishes, so signed-in people never see a flash of signed-out pages.
export const session = reactive({ known: !model.identity.enabled, id: null as string | null, label: null as string | null, administrator: false, roles: [] as string[] })

export function applySession(current: IdentitySession | undefined) {
  const identity = current?.authenticated ? current.identity : null
  session.id = identity?.id ?? null
  session.label = identity ? identity.label || 'Signed in' : null
  session.administrator = !!identity && !!current?.administrator
  session.roles = identity ? current?.roles ?? [] : []
}

// Rules the visitor meets whatever the record: 'By Anyone', and once signed in 'By Authenticated' and their roles.
function meets(rule: AuthorizationModel): boolean {
  if (rule.kind === 'Anyone') return true
  if (session.label === null) return false
  return rule.kind === 'Authenticated' || (rule.kind === 'Role' && session.roles.includes(rule.role!))
}

// Whether the visitor could use an action: rules they meet, owner rules once signed in (the record decides),
// and everything for Administrators. This hides controls; it never grants access.
export function usable(action: Pick<ActionModel, 'authorizations'>): boolean {
  return session.administrator || action.authorizations.some((rule) => meets(rule) || (rule.kind === 'Path' && session.label !== null))
}

// Whether a record action can succeed for the visitor. Rules that name an owner field ('By Owner') pass when
// the record's field holds the visitor; Administrators pass everything.
// Limitation: the client cannot see direct grants, so a granted account gets no control here; expose grants in the session if that matters.
export function usableOn(action: Pick<ActionModel, 'authorizations'>, record: BeverRecord): boolean {
  return session.administrator || action.authorizations.some((rule) => meets(rule) ||
    (rule.kind === 'Path' && session.id !== null && record[toRequestFieldName(rule.path!.segments[0]!)] === session.id))
}

// Validation errors the server returned for individual fields, keyed by request field name.
export function fieldErrors(error: unknown): Record<string, string> {
  const errors = error instanceof BeverHttpError ? (error.body as { errors?: unknown } | null)?.errors : undefined
  const result: Record<string, string> = {}
  if (Array.isArray(errors)) {
    for (const item of errors) {
      if (item && typeof item === 'object' && 'field' in item && 'message' in item) result[String(item.field)] ??= String(item.message)
    }
  }
  return result
}

// Plain-language text for a failed request. A 401 means the session ended, so the visitor is signed out
// and pages switch to their sign-in panels.
export function requestError(error: unknown, subject: string): string {
  if (!(error instanceof BeverHttpError)) return 'Could not reach the server. Check your connection and try again.'
  switch (error.status) {
    case 401:
      applySession(undefined)
      return 'Your session ended. Sign in again.'
    case 403: return `You don't have access to ${subject}.`
    case 404: return `This ${subject} no longer exists.`
    case 409: return `This ${subject} is still used by other records, so it cannot be deleted.`
    case 429: return 'Too many attempts. Wait a minute and try again.'
  }
  const errors = (error.body as { errors?: Array<{ message?: string } | string> } | null)?.errors
  if (Array.isArray(errors) && errors.length > 0) return errors.map((item) => typeof item === 'string' ? item : item.message).join(' ')
  return error.status >= 500 ? 'Something went wrong on the server. Try again.' : 'The request could not be completed.'
}
