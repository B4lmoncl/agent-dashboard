FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production=false

COPY . .
RUN npm run build
RUN mkdir -p /app/data

# Create non-root user + install su-exec for privilege dropping
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && apk add --no-cache su-exec
RUN chown -R appuser:appgroup /app /app/data

# Entrypoint fixes volume permissions then drops to appuser
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/config || exit 1

# Runs as root initially so entrypoint can fix volume perms, then drops to appuser
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
