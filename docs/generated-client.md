# Generated client rules

The template client renders any model without knowing its entities. These rules keep it honest: it shows only what the server will allow, never exposes record IDs, and never invents behavior that the model does not declare. They apply to every template. The server-side rules are in [bever/docs/runtime.md](https://github.com/bever-team/bever/blob/main/docs/runtime.md).

## Source of truth

- Every page, column, form, and button derives from the compiled model (`bev/.output/model.json`) through `@bever/sdk`. No entity or field names are hard-coded.
- Presentation defaults come from `resolveEntityPresentation` in the SDK. The client does not compute its own defaults.
- The server decides every request. The client hides controls it expects to fail, as a convenience only.

## What visitors see

- Signed out, only actions declared `By Anyone` get links, cards, and buttons. A page that needs a signed-in visitor shows a sign-in panel; the home page shows one when nothing is public.
- Signed in, actions appear when a rule could allow them: `By Authenticated`, a role in the session's `roles` (`By <Role>`), or an owner rule. Record actions with owner rules (`By <Field>`) appear on records the visitor owns. Administrators see everything.
- A signed-in visitor who opens a page their roles do not allow sees the server's answer, not a sign-in panel: a grant may still allow it.
- A `401` from any request means the session ended: the client signs the visitor out.

## People

When the model declares roles, Administrators get a *People* page (`/people`) listing accounts with a switch per role. Each switch sends one `PATCH /_identity/accounts/{id}` with the account's full role list; the row shows the server's answer, and an account's switches are disabled while its save is pending. Other visitors never see the page's link, and a direct visit explains that only Administrators manage people. The path does not end in "s", so it cannot collide with an entity route.

## Presentation

- `Mode None` and `Hidden true` remove the generated control and its route. `Place` decides where a control appears. The same decision applies to buttons, routes, and direct visits to a route: hiding a button alone is not enough.
- `Update` and `Delete` do not require `Read`. An entity with mutations but no suitable context renders no control rather than a fabricated one.

## Record context

A record control needs a legitimate record from an authorized response the visitor just received (a list row or a detail page). An ID or URL alone is not enough.

- An edit form opens only when that record supplies every editable field (`hasCompleteEditContext`). Missing is not the same as `null`: absent values are never guessed, defaulted, or fetched by escalating to `Read`.
- A direct visit to an edit URL without such context shows a message instead of a form. There are no blind or manual-ID edit forms.

## Inline editing

With `Editing Mode Inline`:

- At most one row has a draft. Save and Cancel are explicit.
- Cancel and an unchanged Save send nothing. A changed Save sends one ordinary `PATCH` with only the changed fields.
- While a save is pending, Save, Cancel, and editing another row are disabled. A failure keeps the draft for retry; success replaces the row with the server's response.
- Losing context (navigation, a reloaded list) discards the draft. Nothing is saved automatically.

There is no batch, transaction, or rollback contract behind inline editing.

## References

- References show the label from the record's `_labels`, *Untitled* for an empty label, and *Unavailable* when the label is `null`. Record headings without a label use the entity label. Record IDs are never displayed or typed.
- Every relationship in a generated create or edit form uses a picker backed by the server's lookup routes. The client never loads or filters whole lists and never offers manual ID entry.
- `Combobox` (default) and `Modal` page through lookup results with *Load more* when the response has a `nextCursor`, and show a search box only when the picker is searchable. Stale responses are ignored.
- `Dropdown` requests exactly 50 items without search. If the response has a `nextCursor`, the list is too large and the picker shows a message instead of a truncated list.
- Optional references can be cleared; required ones cannot.
- `-> Identity` fields use the context-bound account picker routes of the containing Create or Update action.

## Forms

- Create forms seed declared defaults and, when every `Create` rule is an owner rule, fill the owner field with the signed-in account instead of offering a choice.
- Server validation errors, including failed entity rules, are shown next to their fields, or above the form's buttons when the form does not show the field. The client never evaluates rules and never relies on its own validation alone.
- Leaving a form with unsaved changes asks first.
