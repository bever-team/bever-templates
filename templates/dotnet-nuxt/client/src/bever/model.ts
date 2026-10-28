import { createBeverApp, createBeverClient } from '@bever/sdk'
import type { BeverApp, BeverClient, BeverModel } from '@bever/sdk'

// The compiled semantic model (bev/.output/model.json). Every page, column, and form derives from it.
import rawModel from '../../../bev/.output/model.json'

export const model = rawModel as unknown as BeverModel

export const app: BeverApp = createBeverApp(model)

let client: BeverClient | undefined

// The API shares the app's origin: in development the dev server proxies /api to the server,
// and in production the server hosts the built app.
export function useBeverClient(): BeverClient {
  client ??= createBeverClient({
    model,
    // Limitation: one token request per change keeps the token bound to the current sign-in; cache it if latency matters.
    antiforgeryToken: async () => {
      const response = await fetch('/api/v1/_antiforgery/token', { credentials: 'same-origin' })
      return response.ok ? ((await response.json()) as { token?: string }).token : undefined
    },
  })
  return client
}
