# AGENTS.md

Guidance for coding agents working in this repository. Humans: see [CONTRIBUTING.md](CONTRIBUTING.md).

## What this is

The project templates that `bever new` copies. Each folder under `templates/` is a complete project; the CLI bundles them at build time.

| Path | Role |
| --- | --- |
| `templates/dotnet-nuxt/bev/app.bev` | Starter model |
| `templates/dotnet-nuxt/server/Program.cs` | ASP.NET Core host: Bever API, antiforgery token route, sign-in rate limit, static client |
| `templates/dotnet-nuxt/client/src/bever/` | Model loading, presentation helpers, edit context, session |
| `templates/dotnet-nuxt/client/src/pages/`, `components/` | Model-driven pages, record table, forms, reference pickers |
| `templates/dotnet-nuxt/client/test/` | Vitest tests against a compiled fixture model |
| `scripts/verify.sh` | End-to-end check with locally packed bever, bever-js, and bever-cli |

## Read first

| Topic | Document |
| --- | --- |
| Generated client rules | [docs/generated-client.md](docs/generated-client.md) |
| Placeholders and layout | [README.md](README.md) |
| Presentation defaults | [bever.dev/guide/presentation](https://bever.dev/guide/presentation) (`../bever.dev/docs/guide/presentation.md` when checked out alongside) |
| SDK | [bever.dev/reference/sdk](https://bever.dev/reference/sdk) |
| HTTP API and runtime rules | [bever.dev/reference/http-api](https://bever.dev/reference/http-api), [bever/docs/runtime.md](https://github.com/bever-team/bever/blob/main/docs/runtime.md) |
| Project structure and deployment | [bever.dev/guide/project-structure](https://bever.dev/guide/project-structure), [bever.dev/guide/deployment](https://bever.dev/guide/deployment) |

## Commands

```sh
scripts/verify.sh       # needs bever, bever-js, bever-cli cloned alongside; run before any cross-repo hand-off
# client tests, from a generated project's client/ (after npm install):
npm test && npm run typecheck
# after a semantic model change, from templates/dotnet-nuxt/client:
bever compile test/fixture/bev --output test/fixture/model.json
```

## Rules

- Follow [docs/generated-client.md](docs/generated-client.md): the client derives everything from the model, hides what it expects to fail, never shows record IDs, and never invents behavior.
- No license or copyright notice inside `templates/`: generated projects belong to their users.
- Use only the placeholders listed in the README; any other `__UPPER_CASE__` token fails project creation.
- Do not commit generated folders or lock files inside `templates/`.
- UI changes: check the generated app in a browser at desktop and phone width, in light and dark themes. Keep it accessible: labelled inputs, keyboard-usable menus and pickers, visible focus.
- Mark deliberate simplifications with a `Limitation:` comment naming the ceiling.
