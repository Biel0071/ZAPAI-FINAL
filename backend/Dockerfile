# ============================================================================
# ZAPAI BACKEND DOCKERFILE
# ============================================================================

FROM node:18-alpine

# Install dependencies for Baileys (WhatsApp)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg \
    imagemagick \
    webp

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

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
  CMD node -e "require('http').get('http://localhost:4025/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start backend
CMD ["node", "server.js"]
