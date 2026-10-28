#!/bin/sh
# 'migrate' brings the database up to date with bev/ and exits; run it as a release step.
# Anything else starts the app with those arguments.
set -e
if [ "$1" = "migrate" ]; then
  exec /opt/bever/bever migration apply --bev /app/bev
fi
cd /app/server
exec dotnet __PROJECT_DOTNET_NAME__.Server.dll "$@"
