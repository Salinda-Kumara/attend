FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# import script + its deps (xlsx, pg, dotenv) for: docker compose run --rm app node scripts/import.js <file>
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/node_modules/xlsx ./node_modules/xlsx
COPY --from=build /app/node_modules/dotenv ./node_modules/dotenv
USER node
EXPOSE 3000
CMD ["node", "server.js"]
