# Bever project templates

The templates that [`bever new`](https://bever.dev/reference/cli#bever-new) copies to create a project. Each folder under `templates/` is one complete project.

| Template | Stack |
| --- | --- |
| [`dotnet-nuxt`](templates/dotnet-nuxt) | ASP.NET Core 10 server, Nuxt 4 client with Tailwind CSS and shadcn-vue, SQLite, Docker |

The [bever CLI](https://github.com/bever-team/bever-cli) bundles these templates at build time, so a CLI always creates projects from the templates of its own version.

## Placeholders

`bever new` replaces these tokens in file names and file contents:

| Token | Example for `bever new "Acme Tasks"` |
| --- | --- |
| `__PROJECT_DISPLAY_NAME__` | `Acme Tasks` |
| `__PROJECT_DOTNET_NAME__` | `AcmeTasks` |
| `__PROJECT_NPM_NAME__` | `acme-tasks` |
| `__BEVER_VERSION__` | the CLI's version, used for `Bever.AspNetCore`, `@bever/sdk`, and `Bever.Cli` |

A template file with any other `__UPPER_CASE__` token fails project creation.

## The dotnet-nuxt template

```text
bev/app.bev                  starter model: projects and tasks with sign-up
client/                      Nuxt app driven by the model
  src/pages/                 home, sign-in, entity list, detail, and form pages
  src/components/            record table, dynamic forms, reference pickers, sign-in panel
  src/components/ui/         shadcn-vue components
  test/                      Vitest tests against a compiled fixture model
server/Program.cs            Bever API, sign-in rate limit, persistent keys, static client hosting
Dockerfile                   one image for client and API
```

## Develop

Try a change by creating a project from your checkout:

```sh
bever new "Template Check" --template templates/dotnet-nuxt
cd "Template Check" && bever dev
```

[`scripts/verify.sh`](scripts/verify.sh) checks the whole chain before a release. With `bever`, `bever-js`, and `bever-cli` cloned next to this repository, it packs them with a local version, creates a project from this template, and builds, type-checks, tests, and generates it:

```sh
scripts/verify.sh
```

The client tests use `templates/dotnet-nuxt/client/test/fixture`; recompile its model with `bever compile test/fixture/bev --output test/fixture/model.json` (from `client/`) when the semantic model changes.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Licensed under [MIT No Attribution](LICENSE). Projects created from these templates are yours: you do not need to keep a copyright notice. "Bever" and the Bever logo are trademarks; see [TRADEMARKS.md](https://github.com/bever-team/bever/blob/main/TRADEMARKS.md).
