FROM node:23-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Pin pnpm to v9 — matches the version used in CI (pnpm/action-setup).
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app
# The Cypress binary is only needed for the e2e tests, never in the built
# assets — skip the heavy download during the image build.
ENV CYPRESS_INSTALL_BINARY=0
COPY package.json package.json
COPY pnpm-lock.yaml pnpm-lock.yaml
RUN pnpm install

COPY . .

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm run build


FROM nginx:1

COPY --from=build /app/dist /usr/share/nginx/html
