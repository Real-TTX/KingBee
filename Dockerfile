# --- 1) Build the browser game (Vite) -------------------------------------
FROM node:24-alpine AS web
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

# --- 2) Publish the ASP.NET Core server -----------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS server
WORKDIR /src
COPY server/KingBee.Server/KingBee.Server.csproj server/KingBee.Server/
RUN dotnet restore server/KingBee.Server/KingBee.Server.csproj
COPY server/ server/
RUN dotnet publish server/KingBee.Server/KingBee.Server.csproj -c Release -o /app --no-restore

# --- 3) Runtime -------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=server /app ./
COPY --from=web /web/dist ./wwwroot
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "KingBee.Server.dll"]
