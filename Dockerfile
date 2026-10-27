# The Agentcut website and studio page (Next.js standalone server).
# The helper (packages/agentcut) runs on each user's own computer, not here.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/agentcut/package.json packages/agentcut/
RUN npm ci --ignore-scripts --no-audit --no-fund

FROM node:24-bookworm-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_APP_URL=https://agentcut.synteq.app
ARG NEXT_PUBLIC_MUSIC_CDN_URL=
ARG NEXT_PUBLIC_BROLL_CDN_URL=https://media.vladpalacio.com/agentcut/broll
# The share-link Worker (workers/share/README.md). Empty hides the Share button.
ARG NEXT_PUBLIC_SHARE_API_URL=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_MUSIC_CDN_URL=$NEXT_PUBLIC_MUSIC_CDN_URL \
    NEXT_PUBLIC_BROLL_CDN_URL=$NEXT_PUBLIC_BROLL_CDN_URL \
    NEXT_PUBLIC_SHARE_API_URL=$NEXT_PUBLIC_SHARE_API_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
