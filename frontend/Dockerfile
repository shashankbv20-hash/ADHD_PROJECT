# Attune frontend container (Next.js). See docs/deployment.md.
#
# NEXT_PUBLIC_* values are public and are baked into the JavaScript at BUILD time, so pass them
# as build arguments. Never pass secrets here: nothing in this image needs one.
#
#   docker build -t attune-web \
#     --build-arg NEXT_PUBLIC_DATA_PROVIDER=firebase \
#     --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.org \
#     --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=... (and the other Firebase Web App values) .
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_DATA_PROVIDER=demo
ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_FIREBASE_API_KEY=
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=
ARG NEXT_PUBLIC_FIREBASE_APP_ID=
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
ENV NEXT_PUBLIC_DATA_PROVIDER=$NEXT_PUBLIC_DATA_PROVIDER \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin appuser
COPY --from=build --chown=appuser /app/package.json ./package.json
COPY --from=build --chown=appuser /app/node_modules ./node_modules
COPY --from=build --chown=appuser /app/.next ./.next
COPY --from=build --chown=appuser /app/public ./public
COPY --from=build --chown=appuser /app/next.config.ts ./next.config.ts
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "exec npx next start --port ${PORT} --hostname 0.0.0.0"]
