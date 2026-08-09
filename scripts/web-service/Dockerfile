FROM node:20-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Vite inlines VITE_* vars into the bundle at build time, so this has to be
# a build arg, not a runtime environment variable on the served container.
ARG VITE_CALL_REQUESTS_API_URL
ENV VITE_CALL_REQUESTS_API_URL=$VITE_CALL_REQUESTS_API_URL
RUN npx nx run web-service:build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /workspace/dist/apps/web-service /usr/share/nginx/html
COPY scripts/web-service/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
