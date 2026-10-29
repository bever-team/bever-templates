# __PROJECT_DISPLAY_NAME__

A business application built with [Bever](https://bever.dev).

```text
bev/      The business model: entities, fields, actions, and who may use them
client/   The web app (Nuxt), driven by the model
server/   The API (ASP.NET Core), which enforces the model
```

## Run it

You need the [.NET 10 SDK](https://dotnet.microsoft.com/download), [Node.js 20.19 or later](https://nodejs.org), and the Bever CLI (`dotnet tool install --global --prerelease Bever.Cli`).

```sh
bever dev
```

The app opens at <http://localhost:3000> and the API listens on <http://localhost:5100>. The first run installs the client's packages and creates the database in `.bever/bever.db`.

Edit `bev/app.bev` while `bever dev` runs. Every save recompiles the model, restarts the API, and refreshes the app. When a change affects the database (a new field, a new entity), `bever dev` shows the plan and asks before it creates and applies a migration in `bev/migrations/`. Commit those files: they are how other environments get the same database.

## Change the model

The model in `bev/app.bev` is the source of truth. A few things to try:

```bev
Entity Task
    Field Title Text(200)
    Field Estimate Decimal?                  # a new optional field
    Field Status Enum(ToDo, InProgress, Done) = ToDo

Action Read, Update Task
    By Assignee                             # only the assignee may open and change a task
```

See the [language reference](https://bever.dev/reference/language) for every construct.

## Customize the app

`client/` and `server/` are ordinary projects that you own. Change anything:

- **Pages and components** live in `client/src`. Each page reads the model, so a new entity gets its pages automatically; replace any page with your own Vue code.
- **Theme**: colors and fonts are CSS variables in `client/src/assets/index.css`. The UI uses [shadcn-vue](https://www.shadcn-vue.com) components in `client/src/components/ui`.
- **Server behavior**: `server/Program.cs` is a normal ASP.NET Core app. Add middleware, endpoints, or services next to Bever.

The [customization guide](https://bever.dev/guide/customizing) has examples.

## Accounts

The model declares `Identity`, so people sign in with an email address and a password. To make someone an Administrator (allowed to perform every action):

```sh
bever identity bootstrap --email you@example.com     # creates the first Administrator
bever identity admin add --email teammate@example.com
```

## Deploy

Build one container that serves the app and the API:

```sh
docker build -t __PROJECT_NPM_NAME__ .
docker volume create __PROJECT_NPM_NAME__-data
docker run --rm -v __PROJECT_NPM_NAME__-data:/app/.bever __PROJECT_NPM_NAME__ migrate
docker run -d -p 8080:8080 -v __PROJECT_NPM_NAME__-data:/app/.bever __PROJECT_NPM_NAME__
```

Serve it over HTTPS (a reverse proxy in front of port 8080 is fine): sign-in cookies are marked Secure outside development. Run `migrate` before starting a new version so the database matches it. The [deployment guide](https://bever.dev/guide/deployment) covers configuration, backups, and hosting without Docker.

## Commands

| Command | What it does |
| --- | --- |
| `bever dev` | Run the app with live reload |
| `bever check` | Check `bev/` for errors |
| `bever migration add <name>` | Plan database changes into a migration file |
| `bever migration apply` | Apply migrations to `.bever/bever.db` |
| `npm --prefix client test` | Run the client tests |
| `npm --prefix client run generate` | Build the client into `server/wwwroot` |
