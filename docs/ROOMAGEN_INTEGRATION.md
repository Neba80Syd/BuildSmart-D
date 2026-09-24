# BuildSmart AI — Roomagen Developer API Integration

This document serves as the complete technical, operational, and architectural reference for the Roomagen Developer API integration within the BuildSmart construction-management platform.

---

## 1. Executive Summary & Design Principle

BuildSmart integrates Roomagen as an external AI visualization service while preserving the platform's core architecture and role-based construction workflows.

The integration adheres strictly to BuildSmart's division of responsibilities:
- **Google Gemini API**: Architectural intelligence, natural language requirement interpretation, room dimension reasoning, conversational plan mutations, and BOQ estimation.
- **Roomagen API**: Asynchronous visual generation, converting hand-drawn sketches into 2D floor plans, generating 3D concept visualizations, and architectural plan colorization.
- **Three.js / React Three Fiber / Drei**: Interactive, client-side 3D spatial geometry inspection and walk-through rendering.
- **BuildSmart Core**: User authentication, role authorization, project management, architect escrow & wallet, vendor marketplace, BOQ generator, notifications, and real-time WebSockets.

> [!IMPORTANT]
> **Advisory Disclaimer**: All Roomagen-generated designs are classified as visual design assistance. Output drawings are not structurally certified or construction-approved until an architect reviews, edits, and certifies the deliverables.

---

## 2. Environment Configuration

All Roomagen credentials and settings are managed exclusively on the server side:

```env
# Roomagen API Key (Keep secret — never expose to client bundles or React components)
ROOMAGEN_API_KEY=your_roomagen_api_key_here

# Provider Mode: 'roomagen' (default production) or 'mock' (local dev & testing)
ROOMAGEN_PROVIDER=roomagen

# API Base URL (defaults to https://api.roomagen.com/api/v1)
ROOMAGEN_BASE_URL=https://api.roomagen.com/api/v1

# Optional Webhook Secret for callback authenticity verification
ROOMAGEN_WEBHOOK_SECRET=your_optional_webhook_secret
```

### Security Invariants:
- **Zero Client Exposure**: The API key is strictly accessed via server-side modules (`Backend/services/roomagen/`). It is never exposed via `NEXT_PUBLIC_*` variables, never serialized into HTML, and never returned in API payloads.
- **Sanitized Error Handling**: If the API key is missing or invalid, the backend reports a safe error without exposing system paths or credential fragments.

---

## 3. Supported Roomagen Tools

Tool mappings are strictly defined and encapsulated within `Backend/services/roomagen/roomagen.types.ts`:

| Internal Enum | Canonical Roomagen API Slug | Description |
| :--- | :--- | :--- |
| `SKETCH_TO_FLOOR_PLAN` | `sketch-to-floor-plan` | Converts rough hand-drawn sketches or floor doodles into structured 2D architectural plans. |
| `FLOOR_PLAN_TO_3D` | `floor-plan-to-3d` | Generates a 3D visual concept scene from a 2D floor plan layout. |
| `FLOOR_PLAN_COLORIZE` | `floor-plan-colorize` | Enhances technical architectural drawings with materials, textures, and color tones. |

---

## 4. Database Schema & Architecture

The database model is defined in `Backend/prisma/schema.prisma` and backed by PostgreSQL with an idempotent migration runner in `Backend/lib/pg-setup.ts`:

```prisma
model RoomagenJob {
  id             String    @id
  projectId      String?   @map("project_id")
  userId         String    @map("user_id")
  architectId    String?   @map("architect_id")
  roomagenJobId  String?   @unique @map("roomagen_job_id")
  tool           String
  status         String    @default("PENDING")
  inputAssetUrl  String?   @map("input_asset_url")
  outputAssetUrl String?   @map("output_asset_url")
  inputAssetId   String?   @map("input_asset_id")
  outputAssetId  String?   @map("output_asset_id")
  version        Int       @default(1)
  prompt         String?
  options        Json?
  metadata       Json?
  errorMessage   String?   @map("error_message")
  provider       String    @default("roomagen")
  completedAt    DateTime? @map("completed_at")
  failedAt       DateTime? @map("failed_at")
  createdAt      DateTime  @map("created_at")
  updatedAt      DateTime  @map("updated_at")

  @@map("roomagen_jobs")
}
```

### Database Invariants:
- Every job links to the authenticated user and optionally the parent `Project`.
- The `roomagen_job_id` is unique, enforcing database-level deduplication.
- `version` automatically increments per project and tool (v1, v2, v3...), preserving complete architectural revision history.

---

## 5. Asynchronous Processing, Webhooks & Polling Fallback

Roomagen generation is fully asynchronous. The application utilizes a dual-path resolution strategy:

```
[Client Upload] ➔ [Create DB Record] ➔ [Invoke Roomagen API] ➔ [Return Job ID]
                                                                     │
                         ┌───────────────────────────────────────────┴─────────────────────────────┐
                         ▼                                                                         ▼
            [Primary: Webhook Callback]                                                [Fallback: Active Poller]
          POST /api/webhooks/roomagen                                                 GET /api/roomagen/jobs/:id
                         │                                                                         │
                         └─────────────────────────► [Idempotency Guard] ◄─────────────────────────┘
                                                           │
                                             [Update DB Status: COMPLETED]
                                                           │
                                   ┌───────────────────────┴───────────────────────┐
                                   ▼                                               ▼
                       [In-App Notification]                           [WebSocket Event: roomagen:job:updated]
```

### 1. Webhook Endpoint (`POST /api/webhooks/roomagen`)
- Accepts standard Roomagen completion callbacks.
- **Idempotency Guard**: If the job is already marked `COMPLETED`, the webhook returns HTTP 200 immediately without executing duplicate side-effects.
- Verifies authenticity using `ROOMAGEN_WEBHOOK_SECRET` when configured.

### 2. Polling Recovery Fallback (`GET /api/roomagen/jobs/:id`)
- If a webhook fails to deliver (e.g. firewall, tunnel failure, network timeout), any request to retrieve job status checks if the job remains in `PROCESSING`.
- If a running job has been active for more than 2 seconds, the server transparently queries the Roomagen API directly, updates PostgreSQL, and returns the current status.

---

## 6. Service Layer Architecture

The service layer is organized under `Backend/services/roomagen/`:

- `roomagen.types.ts`: Type definitions, interfaces, tool slugs, and provider contracts.
- `roomagen.errors.ts`: Typed error hierarchy (`RoomagenConfigError`, `RoomagenApiError`, `RoomagenValidationError`, `RoomagenJobNotFoundError`, `RoomagenTimeoutError`).
- `roomagen.config.ts`: Safe environment configuration reader and validator.
- `roomagen.client.ts`: Resilient HTTP client with exponential backoff retries and status normalization.
- `roomagen.provider.ts`: `FloorPlanGenerationProvider` abstraction with `RoomagenProvider` (live) and `MockRoomagenProvider` (development).
- `roomagen.service.ts`: Central orchestrator handling job lifecycle, notifications, versioning, and project floor plan promotion.

---

## 7. API Routes Reference

All API routes follow BuildSmart standard response envelopes:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/roomagen/upload` | Uploads sketch image, validates format/size, and returns accessible URL. |
| `GET` | `/api/roomagen/assets/:id` | Directly serves uploaded image assets with caching headers. |
| `POST` | `/api/roomagen/jobs` | Submits a generation job (`SKETCH_TO_FLOOR_PLAN`, `FLOOR_PLAN_TO_3D`, `FLOOR_PLAN_COLORIZE`). |
| `GET` | `/api/roomagen/jobs` | Lists recent jobs for the authenticated user. |
| `GET` | `/api/roomagen/jobs/:id` | Retrieves job status with automatic polling recovery fallback. |
| `POST` | `/api/webhooks/roomagen` | Idempotent webhook receiver for Roomagen completion events. |
| `GET` | `/api/projects/:id/roomagen` | Retrieves all generation history and versions for a project. |
| `POST` | `/api/projects/:id/roomagen` | Generates a new floor plan scoped to a specific project. |
| `POST` | `/api/projects/:id/roomagen/save` | Promotes a completed Roomagen output into an official project `FloorPlan` model. |
| `GET` | `/api/admin/roomagen` | Admin telemetry metrics, success rate, and recent platform generation logs. |

---

## 8. Frontend User Experience — Floor Plan Studio

The Studio is accessible to architects at:
`/architect/floor-plan-studio` (and via one-click link on project cards).

### UI Features:
1. **Upload Area**: Drag-and-drop or browse PNG, JPG, or WebP up to 10 MB.
2. **Action Controls**:
   - *Convert to 2D Floor Plan*: Generates a clean 2D plan from a rough sketch.
   - *Generate 3D Visualization*: Synthesizes a 3D architectural scene.
   - *Colorize Floor Plan*: Enhances 2D plans with professional architectural textures.
   - Button disables immediately upon submission to eliminate duplicate billable calls.
3. **Processing Stages**:
   - Animated progress display showing:
     - ✓ Image uploaded & verified
     - ✓ Request submitted
     - ● Roomagen AI analyzing layout
     - ○ Synthesizing architectural visualization
     - ○ Finalizing high-resolution output
   - Non-blocking: users can navigate elsewhere while generation proceeds in the background.
4. **Before/After Comparison Viewer**:
   - Draggable slider divider handle.
   - Side-by-side mode on desktop.
   - Zoom controls (zoom in, zoom out, reset) and fullscreen inspection.
   - High-resolution download with standardized filenames (e.g. `BuildSmart_Project_FloorPlan_v2.png`).
5. **Save to Project**:
   - Promotes the AI output to an official `FloorPlan` and `Design` record.
   - Automatically makes the plan available to the client for review.
6. **Version History**:
   - Visual gallery of all previous versions (v1, v2, v3...).
   - Clicking any version instantly loads it into the comparison workspace.

---

## 9. Role-Based Workflows

- **Architect Workflow**:
  - Upload sketches, generate 2D plans, generate 3D renders, colorize.
  - Review and save approved versions to project deliverables.
  - Submit deliverables for client review through the existing escrow milestone workflow.
- **Client Workflow**:
  - Clients access approved plans via `/client/floorplans`.
  - View AI floor plan visualization and 3D scenes with zoom and pan.
  - Submit review questions or request revisions according to their design escrow allowance.
- **Admin Workflow**:
  - Platform administrators monitor generation volume, provider health, tool breakdown, and failure rates via `/admin/roomagen`.
  - No private API keys or credentials are ever visible to platform operators.

---

## 10. Development & Testing Mode

To allow testing and local development without consuming production API credits:

```env
ROOMAGEN_PROVIDER=mock
```

In mock mode:
- The provider simulates asynchronous generation (`PENDING` ➔ `PROCESSING` ➔ `COMPLETED`).
- Provides architectural visual outputs.
- Supports full webhook delivery and polling tests.

### Running Automated Test Suites:

```bash
# 1. Roomagen API integration smoke suite
npm run test:roomagen

# 2. Architect escrow & wallet regression suite
npm run test:architect-escrow

# 3. Gemini AI plan generator regression suite
npm run test:gemini

# 4. TypeScript full-project verification
npm run typecheck
```
