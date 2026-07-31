# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
# Copy built files to /usr/share/nginx/html/monitor to match Vite base: '/monitor/'
COPY --from=builder /app/dist /usr/share/nginx/html/monitor

# Configure Nginx to serve the SPA on port 3001 under the /monitor/ path
RUN echo 'server { \
    listen 3001; \
    location /monitor/ { \
        root /usr/share/nginx/html; \
        try_files $uri $uri/ /monitor/index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3001
CMD ["nginx", "-g", "daemon off;"]
