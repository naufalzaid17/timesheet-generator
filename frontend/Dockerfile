# Stage 1: Build the Next.js application
FROM oven/bun:alpine AS builder

WORKDIR /app

# Copy dependency configs
COPY package.json ./

# Install dependencies using Bun
RUN bun install

# Copy application source code
COPY . .

# Set environment variables for production build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Compile the Next.js production build
RUN bun run build

# Stage 2: Runtime image
FROM oven/bun:alpine AS runner

WORKDIR /app

# Copy production assets and dependencies from builder stage
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["bun", "run", "start"]
