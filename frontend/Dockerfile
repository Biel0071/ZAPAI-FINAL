# ============================================================================
# ZAPAI FRONTEND DOCKERFILE
# ============================================================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
ARG VITE_API_URL=http://localhost:4025
ENV VITE_API_URL=${VITE_API_URL}

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
