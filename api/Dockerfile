FROM node:22-bookworm-slim AS build

RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY api/package*.json ./api/
WORKDIR /app/api
RUN npm ci
WORKDIR /app
COPY api ./api
WORKDIR /app/api
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
