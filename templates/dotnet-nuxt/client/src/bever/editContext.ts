import type { BeverRecord } from '@bever/sdk'

const contexts = new Map<string, BeverRecord>()

function key(entityRoute: string, id: string) {
  return `${entityRoute.toLowerCase()}:${id}`
}

export function retainEditContext(entityRoute: string, id: string, record: BeverRecord) {
  contexts.set(key(entityRoute, id), { ...record })
}

export function takeEditContext(entityRoute: string, id: string): BeverRecord | undefined {
  const contextKey = key(entityRoute, id)
  const record = contexts.get(contextKey)
  contexts.delete(contextKey)
  return record
}

export function clearEditContexts() {
  contexts.clear()
}
