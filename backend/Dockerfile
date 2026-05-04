# ============================================================================
# ZAPAI BACKEND DOCKERFILE
# ============================================================================

FROM node:20-alpine

# Install dependencies for Baileys (WhatsApp)
RUN apk add --no-cache \
    bash \
    docker-cli \
    ffmpeg \
    git \
    imagemagick \
    libwebp \
    libwebp-tools \
    postgresql-client

# Build dependencies (removed after npm install)
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++

WORKDIR /app
ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Remove build-time dependencies to keep image slim
RUN apk del .build-deps

# Copy backend code
COPY . .

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create directories
RUN mkdir -p sessions uploads logs

# Expose port
EXPOSE 4025

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -q -T 5 -O /dev/null http://localhost:4025/health || exit 1

# Start backend with startup orchestration
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
