# Stage 1: Build the static frontend
FROM node:18-alpine AS frontend-builder
# Alpine uses musl, but the committed package-lock.json only records the glibc
# (@next/swc-linux-x64-gnu) SWC binary. libc6-compat provides ld-linux-x86-64.so.2
# so that binary can load; without it, `next build` fails to load the SWC binary.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Go backend
FROM golang:1.21-alpine AS backend-builder
RUN apk update && apk add --no-cache git
RUN go install github.com/swaggo/swag/cmd/swag@latest
WORKDIR /app
COPY backend/go.mod backend/go.sum* ./
RUN go mod download || true
COPY backend/ ./
RUN swag init
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o main .

# Stage 3: Unified production image
FROM alpine:latest
# Install CA certs, timezone database, LibreOffice headless, and standard DejaVu fonts for clean spreadsheet rendering
RUN apk --no-cache add ca-certificates tzdata libreoffice udev ttf-dejavu fontconfig

WORKDIR /app

# Copy backend binary, templates, and Swagger docs
COPY --from=backend-builder /app/main .
COPY --from=backend-builder /app/templates ./templates
COPY --from=backend-builder /app/docs ./docs

# Copy static frontend assets
COPY --from=frontend-builder /app/out ./static

EXPOSE 8080

ENV PORT=8080
ENV GIN_MODE=release
ENV TEMPLATE_PATH=templates/master_template.xlsx
ENV STATIC_FILES_PATH=./static

CMD ["./main"]
