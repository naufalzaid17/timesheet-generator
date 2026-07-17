# Timesheet Generator

A containerized monorepo web service that automates monthly timesheet generation (Excel/PDF) directly from a modern Neobrutalism web UI. 

Fill in your daily activities, status, and reporting metadata directly in the frontend. The backend Gin service retrieves Indonesian public holidays, injects your logs into a pre-structured corporate Excel sheet using strict cell coordinates and Excel-native serial formatting, trims unused calendar days, shifts signature blocks, and streams the finished file directly back to your browser.

---

## 🚀 Key Features

### Frontend UI (Next.js)
- **Neobrutalism Design**: Bold black borders, dynamic hover translations, and a premium modern color palette (`neoYellow`, `neoCyan`, `neoPink`, `neoPurple`).
- **Modular Components**: Built with highly focused and decoupled React components (Header, MetadataForm, DailyGrid, StatusMessage, Footer).
- **Dynamic Daily Grid**: Automatically constructs rows corresponding to the exact number of days in the selected month.
- **Smart 24-Hour Input**: Start and End Time fields are built as text inputs to override browser-specific AM/PM settings. Built-in mask auto-inserts colons and autocompletes shorthand entries (e.g., typing `8` expands to `08:00` on focus loss).
- **CORS-Resolved Holiday Fetches**: Queries Indonesia public holidays through our backend proxy, bypassing browser-level CORS and intranet connectivity blocks.
- **Draft Cache Recovery**: Automatically caches all forms, metadata, and grid entries in `localStorage` under `timesheet_draft_data`. Automatically clears the cache upon successful generation and download.
- **Input Blocking**: Grid cells on weekends and public holidays are visually grayed out and disabled.

### Backend API (Go & LibreOffice)
- **Modular Package Architecture**: Separated cleanly into `models`, `handlers` (routing endpoints), and `services` (spreadsheet filling, holidays fetching, PDF converting).
- **Time Day-Fraction Calculations**: Daily hours are computed and written to Excel cells as serial day fractions (e.g. `8.5 hours / 24.0 = 0.354167`) and mapped using custom Excel formatting styles so native summation formulas work out of the box.
- **Dynamic Calendar Trimming**: For months with fewer than 31 days (e.g., February, September), excess days at the bottom of the day grid are deleted from bottom-to-top to prevent cell shifting.
- **Dynamic Formula Rewriting**: Adapts to day trimming by rewriting the `COUNTIF` formulas (`E40:J40`) for columns E to J in the summation row to prevent circular references in Excel.
- **Signature Realignment**: Automatically shifts the employee, reviewer, and approver signature blocks up dynamically (`12 + daysInMonth`) based on the trimmed calendar grid.
- **Local LibreOffice PDF Conversion**: Runs LibreOffice headless CLI natively inside the Alpine container to convert the customized Excel sheet to an A4 PDF in landscape orientation.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, TypeScript.
- **Backend**: Go 1.21, Gin Gonic, Excelize v2 (spreadsheet engine), Swag (Swagger/OpenAPI documentation).
- **PDF Engine**: Local headless LibreOffice CLI.
- **Orchestration**: Single multi-stage unified Docker build, Docker Compose.

---

## 📂 Repository Structure

```
├── backend/
│   ├── handlers/           # HTTP handlers & custom middleware
│   ├── models/             # Shared Go struct data models
│   ├── services/           # Business logic: Excel generation, holidays, PDF conversion
│   ├── templates/          # Excel spreadsheet templates (master_template.xlsx)
│   ├── docs/               # Swagger generated specifications
│   └── main.go             # Server initialization & route mapping
├── frontend/
│   ├── src/components/     # Modular React UI components
│   ├── src/types/          # Frontend TS interface types
│   ├── src/app/            # Next.js pages & Tailwind global styles
│   └── next.config.js      # Next.js config settings
├── Dockerfile              # All-in-one multi-stage production Dockerfile
├── docker-compose.yml      # Single-service production Docker Compose configuration
├── docker-compose.dev.yml  # Local hot-reloading development orchestration (multiservice)
└── docker-compose.prod.yml # Production port-scanned orchestration environment
```

---

## 💻 Local Setup & Development

### Prerequisites
Make sure you have [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed.

### 1. Running in Development (with Hot-Reloading)
Launch the development containers. The backend utilizes `air` to rebuild on Go source changes, and the frontend runs in dev mode with hot-reloading.

```bash
docker compose -f docker-compose.dev.yml up --build
```

- **Frontend UI**: `http://localhost:3000`
- **Backend API**: `http://localhost:8080`
- **Swagger Docs**: `http://localhost:8080/docs`

### 2. Running in Production Mode (All-in-One Image)
Launch the single-service production container.

```bash
docker compose up --build
```

- **Unified Web UI & API**: `http://localhost:8080`
- **Swagger Docs**: `http://localhost:8080/docs`

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
