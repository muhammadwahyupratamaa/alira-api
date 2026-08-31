# syntax=docker/dockerfile:1
FROM node:26-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS dependencies
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY prisma.generate.config.ts ./
COPY prisma ./prisma
COPY src ./src
RUN ./node_modules/.bin/prisma generate --config prisma.generate.config.ts \
  && ./node_modules/.bin/nest build \
  && find dist -type f \( -name '*.d.ts' -o -name '*.js.map' -o -name '*.tsbuildinfo' \) -delete

FROM base AS production-dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm uninstall --no-save prisma \
  && npm cache clean --force

FROM base AS migration
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM base AS runtime
ENV PORT=3000
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "const p=(process.env.API_PREFIX||'api/v1').replace(/^\\/+|\\/+$/g,'');fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/'+p+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
