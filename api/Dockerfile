FROM node:22-alpine AS build
WORKDIR /app
COPY api/package*.json ./api/
WORKDIR /app/api
RUN npm install
WORKDIR /app
COPY api api
WORKDIR /app/api
RUN npx prisma generate && npm run build
CMD ["node", "dist/main.js"]
