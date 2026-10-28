# One image serves the client and the API on port 8080.
#
#   docker build -t __PROJECT_NPM_NAME__ .
#   docker volume create __PROJECT_NPM_NAME__-data
#   docker run --rm -v __PROJECT_NPM_NAME__-data:/app/.bever __PROJECT_NPM_NAME__ migrate
#   docker run -d -p 8080:8080 -v __PROJECT_NPM_NAME__-data:/app/.bever __PROJECT_NPM_NAME__
#
# Serve it over HTTPS (a reverse proxy is fine): sign-in cookies are Secure outside development.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS model
ARG BEVER_VERSION=__BEVER_VERSION__
RUN dotnet tool install Bever.Cli --version $BEVER_VERSION --tool-path /opt/bever
WORKDIR /src
COPY bev bev
RUN /opt/bever/bever compile bev

FROM node:22-slim AS client
WORKDIR /src
COPY client/package*.json client/
RUN if [ -f client/package-lock.json ]; then npm --prefix client ci; else npm --prefix client install --no-audit --no-fund; fi
COPY client client
COPY --from=model /src/bev bev
RUN npm --prefix client run generate

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS server
WORKDIR /src
COPY server server
COPY --from=client /src/server/wwwroot server/wwwroot
RUN dotnet publish server -c Release -o /app/server

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=model /opt/bever /opt/bever
COPY --from=model /src/bev bev
COPY --from=server /app/server server
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/
ENV ASPNETCORE_HTTP_PORTS=8080
RUN mkdir -p /app/.bever && chown app:app /app/.bever
USER app
VOLUME /app/.bever
EXPOSE 8080
ENTRYPOINT ["docker-entrypoint.sh"]
