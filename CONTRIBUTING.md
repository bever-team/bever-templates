# Contributing to the Bever templates

## What belongs here

A template is a complete, working project: a model in `bev/`, a client, a server, and deployment files. Everything a template generates must work out of the box with `bever dev`, pass its own tests, and build for production.

## Making a change

1. Edit `templates/dotnet-nuxt`.
2. Create a project from your checkout and try it: `bever new "Check" --template templates/dotnet-nuxt && cd Check && bever dev`.
3. Run the client tests from `templates/dotnet-nuxt/client` after `npm install` in a generated project, or run `scripts/verify.sh` with `bever`, `bever-js`, and `bever-cli` cloned next to this repository.

## Guidelines

- Follow the [generated client rules](docs/generated-client.md).
- The client reads the model; it never hard-codes entity names. Behavior specific to one app belongs in that app.
- The server decides permissions. The client may hide controls it expects to fail, but must not rely on it.
- Never show record IDs. Use labels, *Untitled*, or *Unavailable*.
- Keep the UI accessible: labels for every input, keyboard-usable menus and pickers, visible focus, and readable contrast in light and dark themes.
- Do not commit generated folders (`node_modules`, `.nuxt`, `.output`, `bin`, `obj`, `wwwroot`) or lock files inside `templates/`.
- Use only the placeholders listed in the [README](README.md).

By participating you agree to follow the [code of conduct](https://github.com/bever-team/.github/blob/main/CODE_OF_CONDUCT.md).
