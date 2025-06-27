FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY tsconfig.multi.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY scripts ./scripts

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    postgresql-client \
    tini

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force || \
    (rm -rf node_modules package-lock.json && npm install --omit=dev && npm cache clean --force)

# Copy built application
COPY --from=builder /app/build ./build
COPY --from=builder /app/scripts ./scripts

# Database migrations removed - using OAuth Token Injection Architecture

# Copy entrypoint script
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# Install postgresql-client for pg_isready and netcat for Redis check
RUN apk add --no-cache postgresql-client netcat-openbsd

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Make entrypoint executable
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

# Environment variables (with defaults)
ENV NODE_ENV=production \
    PORT=8085 \
    HOST=0.0.0.0 \
    LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8085/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

EXPOSE 8085

# Use tini for proper signal handling with our entrypoint
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]

# Start the stateless MCP server
CMD ["node", "build/index.js"]