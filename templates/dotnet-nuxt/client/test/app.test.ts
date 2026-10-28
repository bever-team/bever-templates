import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, h, nextTick } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BeverHttpError, createBeverApp, parseBeverModel, type BeverRecord, type ResolvedInputPresentation } from '@bever/sdk'

// The client tests run against a compiled fixture model (test/fixture/bev/shop.bev), not the app's own model.
const { fixture, client } = vi.hoisted(() => ({
  fixture: {} as { model: any, app: any },
  client: {
    list: vi.fn(), get: vi.fn(), create: vi.fn(), patch: vi.fn(), delete: vi.fn(),
    lookupReferences: vi.fn(), lookupIdentities: vi.fn(),
    login: vi.fn(), logout: vi.fn(), getSession: vi.fn(), register: vi.fn(),
    listAccounts: vi.fn(), setAccountRoles: vi.fn(),
  },
}))
fixture.model = parseBeverModel(readFileSync(resolve(process.cwd(), 'test/fixture/model.json'), 'utf8'))
fixture.app = createBeverApp(fixture.model)
vi.mock('@/bever/model', () => ({ get model() { return fixture.model }, get app() { return fixture.app }, useBeverClient: () => client }))

const { describeField, coerceValue, validateValue, fromLocalDateTimeInput, toLocalDateTimeInput } = await import('@/bever/fieldTypes')
const { formatValue } = await import('@/bever/format')
const { changedPayload, experiencePayload, seedExperience } = await import('@/bever/presentation')
const { applySession, session, usable, usableOn } = await import('@/bever/session')
const RecordTable = (await import('@/components/RecordTable.vue')).default
const ReferencePicker = (await import('@/components/ReferencePicker.vue')).default
const DynamicForm = (await import('@/components/DynamicForm.vue')).default
const AppNav = (await import('@/components/AppNav.vue')).default
const SignInPanel = (await import('@/components/SignInPanel.vue')).default
const PeoplePage = (await import('@/pages/people.vue')).default

const NuxtLink = defineComponent({ props: ['to'], setup: (props, { slots }) => () => h('a', { href: typeof props.to === 'string' ? props.to : '#' }, slots.default?.()) })
const global = { stubs: { NuxtLink }, config: { globalProperties: {} } }
enableAutoUnmount(afterEach)

const product = () => fixture.app.requireEntity('Product')
const field = (name: string) => product().requireField(name)

function record(values: Partial<BeverRecord> = {}): BeverRecord {
  return { id: 'p1', name: 'Desk lamp', price: 24.5, inStock: true, category: 'c1', owner: null, website: null, releasedOn: null, notes: null, _labels: { category: 'Lighting' }, ...values }
}

beforeEach(() => {
  for (const mock of Object.values(client)) mock.mockReset()
  Object.assign(session, { known: true, id: 'u1', label: 'ada@example.com', administrator: false, roles: [] })
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { appName: 'Shop' } }))
  vi.stubGlobal('useRoute', () => ({ path: '/', fullPath: '/', query: {}, params: {} }))
  vi.stubGlobal('navigateTo', vi.fn())
  vi.stubGlobal('useHead', vi.fn())
})

describe('field types', () => {
  it('chooses controls from semantic types', () => {
    expect(describeField(field('Name')).kind).toBe('text')
    expect(describeField(field('Notes')).kind).toBe('textarea')
    expect(describeField(field('Price'))).toMatchObject({ kind: 'number', step: '0.01', required: true })
    expect(describeField(field('InStock'))).toMatchObject({ kind: 'boolean', required: false })
    expect(describeField(field('Website'))).toMatchObject({ kind: 'url', required: false })
    expect(describeField(field('Category')).kind).toBe('relationship')
  })

  it('validates like the server and turns empty optional inputs into null', () => {
    expect(validateValue(describeField(field('Name')), '  ')).toBe('This field is required.')
    expect(validateValue(describeField(field('Name')), 'x'.repeat(121))).toBe('Use at most 120 characters.')
    expect(validateValue(describeField(field('Website')), 'example.com')).toMatch(/http/)
    expect(validateValue(describeField(field('Website')), 'https://example.com')).toBeUndefined()
    expect(validateValue(describeField(field('Price')), 'abc')).toBe('Enter a number.')
    expect(coerceValue(describeField(field('Website')), '')).toBeNull()
    expect(coerceValue(describeField(field('Price')), '12.5')).toBe(12.5)
    expect(coerceValue(describeField(field('Name')), '  Lamp  ')).toBe('Lamp')
  })

  it('shows date-times in local time and stores UTC', () => {
    const utc = fromLocalDateTimeInput('2026-01-31T09:30')!
    expect(utc.endsWith('Z')).toBe(true)
    expect(toLocalDateTimeInput(utc)).toBe('2026-01-31T09:30')
    expect(fromLocalDateTimeInput('')).toBeNull()
  })

  it('formats values for reading', () => {
    expect(formatValue(field('InStock'), true)).toBe('Yes')
    expect(formatValue(field('Price'), 3)).toMatch(/3[.,]00/)
    expect(formatValue(field('ReleasedOn'), '2026-01-31')).toMatch(/2026/)
    expect(formatValue(field('Name'), null)).toBe('')
  })
})

describe('payloads', () => {
  it('seeds defaults, sends every create field, and patches only what changed', () => {
    const entity = product()
    const seed = seedExperience(entity, entity.presentation.creating)!
    // Form values are keyed by field name; payloads use request names.
    expect(seed.InStock).toBe(true)
    expect(experiencePayload(entity, entity.presentation.creating, { ...seed, Name: 'Lamp', Price: '9.5', Website: '' })).toMatchObject({ name: 'Lamp', price: 9.5, website: null, inStock: true })

    const initial = seedExperience(entity, entity.presentation.editing, record())!
    expect(changedPayload(entity, entity.presentation.editing, initial, { ...initial })).toEqual({})
    expect(changedPayload(entity, entity.presentation.editing, initial, { ...initial, Price: '30' })).toEqual({ price: 30 })
  })
})

describe('record table', () => {
  const mountTable = (records: BeverRecord[], saveInline = vi.fn(), query = '') =>
    mount(RecordTable, { props: { entity: product(), records, contextKey: 'products', query, saveInline }, global, attachTo: document.body })

  it('renders the configured columns and reference labels, never stored IDs', () => {
    const wrapper = mountTable([record(), record({ id: 'p2', name: 'Chair', category: 'c9', _labels: { category: null } })])
    expect(wrapper.findAll('th button').map((cell) => cell.text())).toEqual(['Name', 'Price', 'Category', 'In stock'])
    expect(wrapper.text()).toContain('Lighting')
    expect(wrapper.text()).toContain('Unavailable')
    expect(wrapper.text()).not.toContain('c9')
    expect(wrapper.text()).not.toContain('p1')
  })

  it('filters by what the table shows and sorts by column', async () => {
    const records = [record(), record({ id: 'p2', name: 'Armchair', price: 99, _labels: { category: 'Seating' } })]
    const wrapper = mountTable(records, vi.fn(), 'seat')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    await wrapper.setProps({ query: '' })
    await wrapper.findAll('th button')[0]!.trigger('click')
    expect(wrapper.findAll('tbody tr')[0]!.text()).toContain('Armchair')
    await wrapper.setProps({ query: 'nothing' })
    expect(wrapper.text()).toContain('No matches')
  })

  it('edits one row inline, sends one PATCH with the changed fields, and keeps the draft on failure', async () => {
    const rows = [record()]
    const saveInline = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(record({ price: 30 }))
    const wrapper = mountTable(rows, saveInline)

    // An unchanged Save closes the editor without a request.
    await (wrapper.vm as any).beginInline(rows[0])
    await nextTick()
    wrapper.findComponent(DynamicForm).vm.$emit('submit')
    await flushPromises()
    expect(saveInline).not.toHaveBeenCalled()
    expect(wrapper.findComponent(DynamicForm).exists()).toBe(false)

    await (wrapper.vm as any).beginInline(rows[0])
    await nextTick()
    const form = wrapper.findComponent(DynamicForm)
    form.vm.$emit('update:modelValue', { ...form.props('modelValue'), Price: '30' })
    await nextTick()
    form.vm.$emit('submit')
    await flushPromises()
    expect(saveInline).toHaveBeenCalledWith('p1', { price: 30 })
    expect(wrapper.text()).toContain('Could not reach the server')
    expect(wrapper.findComponent(DynamicForm).exists()).toBe(true)

    wrapper.findComponent(DynamicForm).vm.$emit('submit')
    await flushPromises()
    expect(saveInline).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('reconciled')).toHaveLength(1)
    expect(wrapper.findComponent(DynamicForm).exists()).toBe(false)
  })
})

describe('reference picker', () => {
  const categoryPicker = (display: 'Dropdown' | 'Combobox' | 'Modal'): ResolvedInputPresentation => ({ ...product().presentation.creating.inputs.find((input: any) => input.field.name === 'Category')!, display })
  const mountPicker = (props: Record<string, unknown>) => mount(ReferencePicker, { props: { label: 'Category', modelValue: null, ...props }, global, attachTo: document.body })

  it('looks up labels on open and shows the stored selection by its label', async () => {
    client.lookupReferences.mockResolvedValue({ items: [{ id: 'c1', label: 'Lighting' }, { id: 'c2', label: 'Seating' }], nextCursor: 'next' })
    const wrapper = mountPicker({ picker: categoryPicker('Combobox'), modelValue: 'c1', currentLabel: 'Lighting' })
    expect(wrapper.text()).toContain('Lighting')
    expect(client.lookupReferences).not.toHaveBeenCalled()

    await wrapper.get('button[role="combobox"]').trigger('click')
    await flushPromises()
    expect(client.lookupReferences).toHaveBeenCalledWith('categories', { search: '', limit: 20 }, expect.anything())
    const options = [...document.body.querySelectorAll('[role="option"]')]
    expect(options.map((option) => option.textContent?.trim())).toEqual(['Lighting', 'Seating'])
    expect(document.body.querySelector('[data-test="load-more"]')).not.toBeNull()

    ;(options[1] as HTMLElement).click()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['c2'])
  })

  it('shows a stored reference the visitor may not see as Unavailable, never its ID', () => {
    const wrapper = mountPicker({ picker: categoryPicker('Combobox'), modelValue: 'c-secret', currentLabel: null })
    expect(wrapper.text()).toContain('Unavailable')
    expect(wrapper.text()).not.toContain('c-secret')
  })

  it('lets optional pickers clear and keeps required ones set', async () => {
    const optional = mountPicker({ picker: categoryPicker('Combobox'), modelValue: 'c1', currentLabel: 'Lighting' })
    await optional.get('[data-test="clear-reference"]').trigger('click')
    expect(optional.emitted('update:modelValue')).toEqual([[null]])
    const required = mountPicker({ picker: categoryPicker('Combobox'), modelValue: 'c1', currentLabel: 'Lighting', required: true })
    expect(required.find('[data-test="clear-reference"]').exists()).toBe(false)
  })

  it('loads a dropdown with exactly 50 items and refuses to truncate larger sets', async () => {
    client.lookupReferences.mockResolvedValue({ items: [{ id: 'c1', label: 'Lighting' }], nextCursor: 'more' })
    const wrapper = mountPicker({ picker: categoryPicker('Dropdown') })
    await flushPromises()
    expect(client.lookupReferences).toHaveBeenCalledWith('categories', { limit: 50 }, expect.anything())
    expect(wrapper.text()).toContain('too many')
  })

  it('looks up people only inside a create or edit context', async () => {
    client.lookupIdentities.mockResolvedValue({ items: [{ id: 'u1', label: 'ada@example.com' }], nextCursor: null })
    const owner = product().presentation.creating.inputs.find((input: any) => input.field.name === 'Owner')!
    const context = { entityRoute: 'products', action: 'Create' as const, field: 'owner' }
    const wrapper = mountPicker({ picker: owner, label: 'Owner', identityContext: context })
    await wrapper.get('button[role="combobox"]').trigger('click')
    await flushPromises()
    expect(client.lookupIdentities).toHaveBeenCalledWith(context, { search: '', limit: 20 }, expect.anything())
    expect(client.lookupReferences).not.toHaveBeenCalled()
  })
})

describe('forms', () => {
  it('checks values before submitting and shows server errors under their fields', async () => {
    const entity = product()
    const wrapper = mount(DynamicForm, { props: { entity, experience: entity.presentation.creating, modelValue: seedExperience(entity, entity.presentation.creating)! }, global, attachTo: document.body })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('This field is required.')

    await wrapper.setProps({ modelValue: { ...wrapper.props('modelValue'), Name: 'Lamp', Price: 5 }, serverErrors: { price: 'Expected a number.' } })
    expect(wrapper.text()).toContain('Expected a number.')
  })

  it('shows server errors for fields the form does not show above its buttons', async () => {
    const entity = product()
    const wrapper = mount(DynamicForm, { props: { entity, experience: entity.presentation.editing, modelValue: seedExperience(entity, entity.presentation.editing)!, serverErrors: { name: 'Name is taken', releasedOn: 'Release date cannot be in the future' } }, global })
    expect(wrapper.findAll('[role="alert"]').map((alert) => alert.text())).toEqual(['Name is taken', 'Release date cannot be in the future'])
  })
})

describe('signed-out visitors', () => {
  it('see only what By Anyone allows, and sign-in reveals the rest', async () => {
    session.label = null
    const nav = mount(AppNav, { props: { appName: 'Shop' }, global })
    expect(nav.text()).toContain('Categories')
    expect(nav.text()).not.toContain('Products')
    expect(nav.text()).toContain('Sign in')
    session.label = 'ada@example.com'
    await nextTick()
    expect(nav.text()).toContain('Products')
  })

  it('sign in, and explain failures in plain language', async () => {
    session.label = null
    client.login.mockRejectedValueOnce(new BeverHttpError(new Response(null, { status: 401 }), null)).mockResolvedValueOnce({ authenticated: true, identity: { id: 'u1', label: 'ada@example.com' }, administrator: false })
    const wrapper = mount(SignInPanel, { global, attachTo: document.body })
    await wrapper.get('input[type="email"]').setValue('ada@example.com')
    await wrapper.get('input[type="password"]').setValue('wrong password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('The email or password is incorrect.')

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(session.label).toBe('ada@example.com')
    expect(wrapper.emitted('signed-in')).toHaveLength(1)
  })

  it('offer record actions with owner rules only to the owner or an Administrator', () => {
    const update = { authorizations: [{ kind: 'Path' as const, path: { segments: ['Owner'] } }] }
    Object.assign(session, { id: 'u1', label: 'ada@example.com', administrator: false })
    expect(usableOn(update, record({ owner: 'u1' }))).toBe(true)
    expect(usableOn(update, record({ owner: 'u2' }))).toBe(false)
    session.administrator = true
    expect(usableOn(update, record({ owner: 'u2' }))).toBe(true)
    Object.assign(session, { id: null, label: null, administrator: false })
    expect(usableOn(update, record({ owner: 'u1' }))).toBe(false)
  })

  it('sign-in reveals pages for the roles the account holds, and People for Administrators', async () => {
    const nav = mount(AppNav, { props: { appName: 'Shop' }, global })
    expect(nav.text()).not.toContain('Suppliers')
    applySession({ authenticated: true, identity: { id: 'u1', label: 'ada@example.com' }, administrator: false, roles: ['Manager'] })
    await nextTick()
    expect(nav.text()).toContain('Suppliers')
    expect(nav.text()).not.toContain('People')
    const deleteByBuyer = { authorizations: [{ kind: 'Role' as const, path: null, role: 'Buyer' }] }
    expect(usable(deleteByBuyer)).toBe(false)
    applySession({ authenticated: true, identity: { id: 'u1', label: 'ada@example.com' }, administrator: true, roles: [] })
    await nextTick()
    expect(nav.text()).toContain('People')
    expect(usableOn(deleteByBuyer, record())).toBe(true)
    applySession(undefined)
    expect(session.roles).toEqual([])
  })

  it('never shows a registration option the model does not enable', () => {
    session.label = null
    expect(mount(SignInPanel, { global }).text()).not.toContain('Create an account')
  })
})

describe('people', () => {
  const bob = { id: 'u2', label: 'bob@example.com', administrator: false, roles: ['Buyer'] }

  it('lets Administrators assign roles and shows what the server saved', async () => {
    session.administrator = true
    client.listAccounts.mockResolvedValue({ items: [{ id: 'u1', label: 'ada@example.com', administrator: true, roles: [] }, bob], nextCursor: null })
    client.setAccountRoles.mockResolvedValue({ ...bob, roles: ['Manager', 'Buyer'] })
    const wrapper = mount(PeoplePage, { global, attachTo: document.body })
    await flushPromises()
    expect(wrapper.text()).toContain('ada@example.com')
    expect(wrapper.text()).toContain('(you)')
    expect(wrapper.text()).toContain('Administrator')

    const bobRoles = wrapper.get('[aria-label="Roles of bob@example.com"]')
    const switches = bobRoles.findAll('[role="switch"]')
    expect(switches.map((item) => item.attributes('aria-checked'))).toEqual(['false', 'true'])
    await switches[0]!.trigger('click')
    await flushPromises()
    expect(client.setAccountRoles).toHaveBeenCalledExactlyOnceWith('u2', ['Manager', 'Buyer'])
    expect(wrapper.get('[aria-label="Roles of bob@example.com"]').findAll('[role="switch"]').map((item) => item.attributes('aria-checked'))).toEqual(['true', 'true'])
  })

  it('asks other people to see an Administrator and never lists accounts for them', async () => {
    const wrapper = mount(PeoplePage, { global })
    await flushPromises()
    expect(wrapper.text()).toContain('Only Administrators manage people')
    expect(client.listAccounts).not.toHaveBeenCalled()
  })
})
