FROM node:24-alpine AS build
WORKDIR /repo
COPY packages/api-client ./packages/api-client
COPY apps/web/package*.json ./apps/web/
WORKDIR /repo/apps/web
RUN npm ci
COPY apps/web .
RUN npm run build
FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
