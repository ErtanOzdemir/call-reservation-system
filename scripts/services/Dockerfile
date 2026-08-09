ARG APP

FROM node:20-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG APP
RUN npx nx run ${APP}:build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ARG APP
COPY --from=build /workspace/dist/apps/${APP}/package.json /workspace/dist/apps/${APP}/package-lock.json ./
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && npm ci --omit=dev \
  && apt-get purge -y --auto-remove python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /workspace/dist/apps/${APP}/main.js ./main.js
ENV NODE_ENV=production
CMD ["node", "main.js"]
