# Stage 1: Build the static frontend with Bun.
FROM oven/bun:alpine AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/bun.lock* ./
RUN bun install
COPY frontend/ ./
RUN bun run build

# Stage 2: Build the Go backend.
FROM golang:1.25-alpine AS backend-builder
RUN apk update && apk add --no-cache git
WORKDIR /app
COPY backend/go.mod backend/go.sum* ./
RUN go mod download || true
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o main .

# Stage 3: Unified production image.
FROM alpine:latest
# CA certs, timezone database (WIB cron), LibreOffice + fonts for optional PDF rendering.
RUN apk --no-cache add ca-certificates tzdata libreoffice udev ttf-dejavu fontconfig

WORKDIR /app

COPY --from=backend-builder /app/main .
COPY --from=backend-builder /app/templates ./templates

# Static frontend export (Next.js `output: export` emits to `out`).
COPY --from=frontend-builder /app/out ./static

EXPOSE 8080

ENV PORT=8080
ENV GIN_MODE=release
ENV STATIC_FILES_PATH=./static

CMD ["./main"]
