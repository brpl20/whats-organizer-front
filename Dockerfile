FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS prod-deps
COPY package.json .
COPY package-lock.json .
COPY pnpm-lock.yaml .
COPY amplify.yml .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build
RUN cp package.json build/

FROM node:20-slim AS prod
ENV NODE_ENV="production"
ENV NODE_OPTIONS="--es-module-specifier-resolution=node"
WORKDIR /app
COPY --from=build /app/build /app/build
COPY --from=prod-deps /app/node_modules /app/node_modules
EXPOSE 8000
CMD ["node", "build/index"]
