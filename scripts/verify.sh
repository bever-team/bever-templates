#!/usr/bin/env bash
# End-to-end check of a template with unreleased packages.
# Expects bever, bever-js, and bever-cli checkouts next to this repository.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
template="$root/bever-templates/templates/${1:-dotnet-nuxt}"
work="$(mktemp -d)"
version="0.1.0-local.$(date +%s)"
trap 'rm -rf -- "$work"' EXIT

step() { printf '\n==> %s\n' "$*"; }

step "Packing bever $version"
dotnet pack "$root/bever/Bever.slnx" -c Release -o "$work/feed" -p:Version="$version" --nologo -v q

step "Packing @bever/sdk $version"
( cd "$root/bever-js" && npm ci --no-audit --no-fund >/dev/null && npm test >/dev/null \
  && mkdir "$work/sdk" && cp package.json package-lock.json "$work/sdk/" && npm version "$version" --no-git-tag-version >/dev/null \
  && npm pack --pack-destination "$work" >/dev/null; status=$?; cp "$work/sdk/package.json" "$work/sdk/package-lock.json" .; exit $status )

step "Building the CLI $version"
dotnet pack "$root/bever-cli/src/Bever.Cli/Bever.Cli.csproj" -c Release -o "$work/feed" -p:Version="$version" \
  -p:BeverLocalFeed="$work/feed" -p:BeverTemplatesDir="$root/bever-templates" --nologo -v q
dotnet tool install Bever.Cli --tool-path "$work/tools" --version "$version" --add-source "$work/feed" >/dev/null

step "Creating a project"
cd "$work"
"$work/tools/bever" new "Verify App" --template "$template"
app="$work/Verify App"
cat > "$app/nuget.config" <<XML
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="local" value="$work/feed" />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
  </packageSources>
</configuration>
XML

step "Checking and compiling the model"
( cd "$app" && "$work/tools/bever" check && "$work/tools/bever" compile && "$work/tools/bever" migration add initial >/dev/null && "$work/tools/bever" migration apply )

step "Building the server"
dotnet build "$app/server" -c Release --nologo -v q

step "Installing, type-checking, and testing the client"
( cd "$app/client" \
  && npm pkg set "dependencies.@bever/sdk=file:$work/bever-sdk-$version.tgz" \
  && npm install --no-audit --no-fund >/dev/null \
  && npm run typecheck \
  && npm test \
  && npm run generate >/dev/null )
test -f "$app/server/wwwroot/index.html"

step "Publishing"
dotnet publish "$app/server" -c Release -o "$work/publish" --nologo -v q
test -f "$work/publish/wwwroot/index.html"

printf '\nTemplate verified with %s.\n' "$version"
