import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { BeverEntity } from '@bever/sdk'
import { app } from './model'

// Resolve a BeverEntity from a kebab-case route name (e.g. "products").
export function findEntityByRoute(routeName: string): BeverEntity | undefined {
  return app.entities.find(
    (entity) => entity.routeName.toLowerCase() === routeName.toLowerCase(),
  )
}

export function useEntityFromRoute(
  routeName: ComputedRef<string>,
): ComputedRef<BeverEntity | undefined> {
  return computed(() => findEntityByRoute(routeName.value))
}
