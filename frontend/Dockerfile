FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
COPY . .
RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-proxy-headers.conf /etc/nginx/proxy_headers.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
