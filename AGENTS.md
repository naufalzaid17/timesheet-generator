# AGENTS.md

Guidance for coding agents working in this repository.

## Repository Overview

- Monorepo with:
  - `frontend/`: Next.js 14 + React + TypeScript UI.
  - `backend/`: Go (Gin) API for timesheet generation and holiday retrieval.
- Root-level Docker and Compose files orchestrate dev/prod environments.

## Key Paths

- Frontend app entry: `frontend/src/app/page.tsx`
- Frontend components: `frontend/src/components/`
- Frontend shared types: `frontend/src/types/`
- Backend entrypoint: `backend/main.go`
- Backend handlers: `backend/handlers/handlers.go`
- Backend services: `backend/services/`
- Backend models: `backend/models/models.go`
- Excel template: `backend/templates/master_template.xlsx`

## Development Commands

Run commands from each package directory unless noted.

### Frontend (`frontend/`)

- Install dependencies: `npm install`
- Run dev server: `npm run dev`
- Build: `npm run build`
- Start production server: `npm run start`

### Backend (`backend/`)

- Run tests: `go test ./...`
- Build: `go build ./...`
- Run app: `go run main.go`

## Important Notes

- Backend currently imports `timesheet-backend/docs` in `backend/main.go`; if Swagger docs are not generated, `go test ./...` and `go build ./...` may fail for the main package.
- Frontend relies on `NEXT_PUBLIC_API_URL` for API host override; empty value defaults to same-origin requests.
- Timesheet draft persistence uses `localStorage` key: `timesheet_draft_data`.

## Change Guidelines

- Keep architecture boundaries intact:
  - Backend HTTP logic in `handlers`, business logic in `services`, shared structs in `models`.
  - Frontend page orchestration in `page.tsx`, reusable UI in `components`.
- Prefer small, targeted changes and preserve existing request/response contracts between frontend and backend.
- Validate frontend changes with `npm run build`.
- Validate backend changes with `go test ./...` and `go build ./...` (and ensure Swagger docs exist if needed).
