# AI-Powered Automated Grading System with Contextual Plagiarism Detection

Sistem koreksi tugas/laporan mahasiswa otomatis menggunakan **Local Large Language Model (LLM)** dengan deteksi plagiarisme berbasis **Sliding Window Memory** dan **Multi-Modal Document Analysis**.

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [Database Design](#database-design)
5. [Authentication & Security](#authentication--security)
6. [AI Grading Pipeline](#ai-grading-pipeline)
7. [Plagiarism Detection System](#plagiarism-detection-system)
8. [Document Processing](#document-processing)
9. [Queue System](#queue-system)
10. [API Design](#api-design)
11. [Frontend Architecture](#frontend-architecture)
12. [Deployment](#deployment)
13. [Environment Configuration](#environment-configuration)
14. [Key Algorithms](#key-algorithms)
15. [TypeScript Type Definitions](#typescript-type-definitions)
16. [Development Setup](#development-setup)

---

## System Overview

**Purpose:** A web-based application for university lecturers to:

- Upload student assignment submissions (PDF/DOCX) via Google Drive links or Google Forms webhook
- Automatically grade submissions using a locally-hosted **Vision-Language Model (VLM)**
- Detect inter-student plagiarism using **Sliding Window Memory** context injection
- Detect exact and near-duplicate submissions via **text hashing**, **shingle-based Jaccard similarity**, and **perceptual image hashing (dHash)**
- Export graded results to CSV
- Manage courses, classes, and assignment rubrics

**Target Users:** University lecturers (single-role system)

**Language:** Indonesian (UI, prompts, error messages)

---

## Technology Stack

| Layer | Technology | Version | Justification |
|---|---|---|---|
| **Framework** | Next.js | 16.2.6 (App Router) | Full-stack React framework; server components, API routes, file-based routing |
| **Language** | TypeScript | 5.x (strict mode) | Type safety across frontend and backend |
| **UI Library** | React | 19.2.4 | Component-based UI |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS; dark theme support |
| **UI Components** | shadcn/ui + @base-ui/react | Latest | Accessible, customizable primitives |
| **Icons** | lucide-react | 1.16.0 | Consistent icon set |
| **Database** | MySQL / MariaDB | Any 8.x+ | Relational; supports Prisma ORM |
| **ORM** | Prisma | 7.8.0 | Type-safe database access; migration management |
| **MariaDB Adapter** | @prisma/adapter-mariadb | 7.8.0 | Direct MariaDB protocol (no MySQL proxy) |
| **AI SDK** | OpenAI Node.js SDK | 6.38.0 | OpenAI-compatible; works with LM Studio, Ollama, OpenAI, OpenRouter, etc. |
| **PDF Processing** | pdf-parse (custom fork) | 2.4.5 | Text extraction + page screenshot rendering |
| **DOCX Processing** | mammoth | 1.12.0 | DOCX text extraction + embedded image reading |
| **Image Processing** | @napi-rs/canvas | 1.0.0 | Server-side canvas for dHash computation |
| **Password Hashing** | bcryptjs | Latest | Salted password hashing (12 rounds) |
| **Notifications** | sonner | 2.0.7 | Toast notification system |
| **Containerization** | Docker | Multi-stage | Alpine-based production image |
| **Deployment** | Next.js Standalone | Built-in | Self-contained output for Docker |

---

## System Architecture

### Layered Architecture (Strict Separation)

```
┌─────────────────────────────────────────────────────┐
│                   Presentation Layer                 │
│  /app (Pages)       /components (UI)                 │
│  Client Components  (useState, useEffect, fetch)     │
├─────────────────────────────────────────────────────┤
│                   Controller Layer                   │
│  /app/api (Route Handlers - Next.js API Routes)      │
│  Parse request -> Call service -> Return response    │
├─────────────────────────────────────────────────────┤
│                   Service Layer                       │
│  /services (Business Logic)                          │
│  aiService, pdfService, documentService,             │
│  memoryService, gradingPipeline, queueService,       │
│  hashUtils                                           │
├─────────────────────────────────────────────────────┤
│                   Data Access Layer                   │
│  /lib (Database connection, Prisma client)           │
│  /prisma (Schema, migrations, seed)                  │
└─────────────────────────────────────────────────────┘
```

**Key Rule:** UI components NEVER call Prisma or external APIs directly. API route handlers are thin — they parse requests, call services, and return responses. All business logic lives in `/services`.

### Data Flow: Assignment Grading

```
Google Drive URL
      │
      ▼
┌─────────────┐     ┌──────────────────┐
│  Webhook     │────>│  Queue Service   │
│  (Google     │     │  (Sequential)    │
│   Forms)     │     └────────┬─────────┘
└─────────────┘              │
                             ▼
                    ┌──────────────────┐
                    │  GradingPipeline │
                    │  processSubmission│
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌──────────┐  ┌────────────┐  ┌──────────┐
       │Download  │  │Document    │  │Memory    │
       │from Drive│  │Processing  │  │Service   │
       └──────────┘  └─────┬──────┘  └────┬─────┘
                           │              │
                    ┌──────▼──────┐       │
                    │ PDF/DOCX    │       │
                    │ Text+Images │       │
                    └──────┬──────┘       │
                           │              │
                    ┌──────▼──────────────▼─────┐
                    │  Duplicate Detection      │
                    │  (text hash / Jaccard /   │
                    │   image dHash)            │
                    └──────┬────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  AI Service │
                    │  (LLM Call) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Save to DB │
                    └─────────────┘
```

### Project Directory Structure

```
app-koreksi-ai-lokal/
├── app/
│   ├── api/
│   │   ├── auth/        (login, register, logout, me)
│   │   ├── courses/     (list, create, delete)
│   │   ├── classes/     (create, delete)
│   │   ├── tasks/       (CRUD, export, retry-failed, rescan)
│   │   ├── assignments/ (CRUD, retry, duplicate, confirm-plagiarism)
│   │   ├── config/      (system configuration)
│   │   ├── health/      (LM Studio connectivity)
│   │   └── webhook/     (Google Forms integration)
│   ├── login/
│   ├── register/
│   ├── settings/
│   └── tasks/[taskId]/
├── components/
│   ├── ui/              (button, card, input, label, badge, table, textarea, sonner)
│   ├── ResultsTable.tsx
│   └── StatusPanel.tsx
├── lib/
│   ├── auth.ts          (HMAC session, bcrypt helpers)
│   ├── db.ts            (Prisma client singleton)
│   └── utils.ts         (cn helper)
├── services/
│   ├── aiService.ts     (LLM communication)
│   ├── pdfService.ts    (PDF processing, Google Drive download)
│   ├── documentService.ts (file type detection, unified processing)
│   ├── memoryService.ts (sliding window context retrieval)
│   ├── gradingPipeline.ts (orchestration, duplicate detection)
│   ├── queueService.ts  (sequential processing queue)
│   └── hashUtils.ts     (dHash, Hamming distance)
├── types/
│   └── index.ts         (shared TypeScript interfaces)
├── prisma/
│   ├── schema.prisma    (database schema)
│   ├── migrations/      (Prisma migrations)
│   └── seed.ts          (initial seed data)
├── generated/           (Prisma client output)
├── public/
├── Dockerfile           (multi-stage build)
├── docker-compose.yml
├── docker-entrypoint.sh
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## Database Design

### Entity Relationship Diagram

```
Lecturer (1) ----< Course (1) ----< Class (1) ----< Task (1) ----< Assignment
                                                                       │
                                                            (self-reference)
                                                          Assignment ----< Assignment
                                                            (duplicateOfId)

SystemConfig (singleton, id="default")
```

### Schema Details

**Lecturer**

| Field | Type | Description |
|---|---|---|
| id | String (CUID) | Primary key |
| name | String | Lecturer's full name |
| email | String (unique) | Login credential |
| password | String | bcrypt hash (12 rounds) |
| createdAt | DateTime | Auto-generated |

**Course**

| Field | Type | Description |
|---|---|---|
| id | String (CUID) | Primary key |
| code | String | e.g., "IF101" |
| name | String | e.g., "Dasar Pemrograman" |
| lecturerId | String | Foreign key -> Lecturer |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |
| *Unique* | [code, lecturerId] | One lecturer can't have duplicate course codes |
| *Index* | lecturerId | Performance optimization |

**Class**

| Field | Type | Description |
|---|---|---|
| id | String (CUID) | Primary key |
| name | String | e.g., "IF-43-01" |
| courseId | String | Foreign key -> Course |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |
| *Unique* | [name, courseId] | Class names are unique within a course |
| *Index* | courseId | Performance optimization |

**Task**

| Field | Type | Description |
|---|---|---|
| id | String (CUID or custom) | Primary key (customizable, e.g., "TASK-001") |
| title | String | e.g., "Tugas 1: Algoritma" |
| rubric | Text | Marking rubric (used in AI prompt) |
| windowSize | Int (default: 3) | Sliding window size for plagiarism memory |
| duplicateScore | Int (default: 50) | Score assigned to duplicate submissions |
| classId | String | Foreign key -> Class |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |
| *Unique* | [title, classId] | Task titles unique within a class |
| *Index* | classId | Performance optimization |

**Assignment**

| Field | Type | Description |
|---|---|---|
| id | String (CUID) | Primary key |
| studentName | String | Student's name |
| fileName | String | Original filename |
| extractedText | Text | Full extracted text from PDF/DOCX |
| score | Int? | AI-assigned score (0-100) |
| feedback | Text? | AI-generated feedback |
| plagiarismNote | Text? | AI plagiarism analysis |
| driveFileUrl | String? | Google Drive URL |
| status | String | pending / processing / done / failed |
| errorMessage | Text? | Error details on failure |
| isDuplicate | Boolean | Flag for duplicate detection |
| duplicateOfId | String? | Self-referencing FK -> Assignment |
| duplicateReason | String? | text-identical / text-similarity / image-match / manual |
| duplicateSimilarity | Float? | Jaccard similarity score |
| detectionSource | String? | deterministic / ai / ai-confirmed / deterministic-reverse |
| textHash | String? | SHA-256 of normalized text |
| imageHashes | Text? | JSON array of dHash strings |
| taskId | String | Foreign key -> Task |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |
| *Unique* | [studentName, taskId] | One submission per student per task |
| *Indexes* | taskId, status, textHash, duplicateOfId, [taskId, status] | Query performance |

**SystemConfig**

| Field | Type | Description |
|---|---|---|
| id | String (default: "default") | Singleton key |
| rubric | Text | Default rubric for new tasks |
| windowSize | Int (default: 3) | Default sliding window size |
| updatedAt | DateTime | Auto-updated |

### Key Design Decisions

1. **Self-referencing Assignment** (`duplicateOfId`) enables tracking which assignment is a duplicate of which original, and the `duplicates` relation provides reverse lookup.
2. **String-based status** instead of enum to allow Prisma `groupBy` aggregation without complex type mappings.
3. **Composite indexes** on `@@unique([studentName, taskId])` prevents duplicate submissions.
4. **`@@map` to lowercase** table names follows MySQL/MariaDB conventions and avoids reserved-word conflicts (`Class` -> `class` is a SQL reserved word).
5. **Cascade deletes** from Lecturer down to Assignment — deleting a Lecturer removes all related data.

---

## Authentication & Security

### Session Management

- **Cookie-based auth** with HMAC-signed tokens
- `lecturer_session` cookie: `<lecturerId>.<HMAC_SHA256_signature>`
- Secret key from `SESSION_SECRET` env var (falls back to `WEBHOOK_SECRET`)
- `httpOnly`, `sameSite: "lax"`, 24-hour expiry
- No session tokens in URLs or response bodies

```
signToken(payload):
  return `${payload}.${HMAC_SHA256(payload, SESSION_SECRET)}`

verifyToken(token):
  parts = token.split(".")
  if parts.length !== 2 → invalid
  if parts[1] !== HMAC_SHA256(parts[0], SESSION_SECRET) → invalid
  return parts[0]  // lecturer ID
```

### Password Storage

- **bcryptjs** with 12 salt rounds (~250ms per hash)
- Migrated from SHA-256 (unsalted) for production security

### API Authentication

Every API route validates the session cookie using `getSessionId()` from `lib/auth.ts`. There is no global middleware — each route handler calls the auth helper independently to ensure explicit auth checking.

```typescript
const sessionId = getSessionId(req);
if (!sessionId) return unauthorizedResponse();
// Proceed with authenticated logic...
```

### Webhook Authentication

- Incoming webhooks optionally verify `X-Webhook-Secret` header against `WEBHOOK_SECRET` env var
- If `WEBHOOK_SECRET` is unset, webhook is public (development mode)

---

## AI Grading Pipeline

The core grading algorithm is implemented in `services/gradingPipeline.ts` and orchestrated by `services/queueService.ts`.

### Step-by-Step Flow

```
1. QUEUE: processSubmission(assignmentId) called by QueueService
   │
2. STATUS: Update assignment to "processing"
   │
3. FETCH: Load assignment + task (rubric, windowSize, duplicateScore)
   │
4. DOWNLOAD: Fetch file from Google Drive public URL
   │
5. EXTRACT: processDocument(buffer)
   ├── Detect file type (magic bytes: %PDF or PK)
   ├── PDF: extract text + page screenshots (up to 3, scale 1.5x)
   ├── DOCX: extract text via mammoth + embedded images
   ├── Compute textHash (SHA-256 of normalized text)
   └── Compute imageHashes (dHash for each page/image)
   │
6. FORWARD DUPLICATE CHECK: findDuplicateCandidate()
   ├── Fetch all prior assignments in same task
   ├── Check 1: Exact text hash match -> "text-identical"
   ├── Check 2: Image dHash match + Jaccard similarity -> "image-match"
   ├── Check 3: Jaccard similarity >= 0.7 -> "text-similarity"
   │
   ├── IF DUPLICATE FOUND:
   │   ├── Mark both as duplicates
   │   ├── Assign duplicateScore to both
   │   └── STOP (no AI grading)
   │
   └── IF NO DUPLICATE -> continue
   │
7. MEMORY: getSlidingWindowContext(windowSize, taskId)
   ├── Fetch last N graded assignments (status: "done")
   ├── Truncate each to 3000 chars
   └── Format as comparison context text
   │
8. AI GRADING: evaluateAssignment()
   ├── Construct OpenAI-compatible request
   ├── System prompt: rubric + sliding window memory + JSON format instruction
   ├── User content: student text + base64 images
   ├── Call LLM (with retry: 2 attempts, 2.5s delay)
   ├── Parse JSON response: { score, feedback, plagiarismNote }
   └── Handle parse errors gracefully
   │
9. SAVE: Write results to Assignment table
   │
10. REVERSE CHECK: runReverseCheck()
    ├── Compare NEW assignment against ALL existing "done" assignments
    ├── Same detection logic as forward check
    ├── If match found, update BOTH assignments
    └── Prevents missed matches when old assignments were already graded
```

### AI Prompt Engineering

The system uses a carefully structured prompt:

**System Prompt:**
```
Anda adalah Asisten Penilai AI Profesional untuk mengoreksi tugas/laporan mahasiswa.

Rubrik Penilaian:
<rubric>

Sliding Window Memory Context (Tugas-tugas sebelumnya):
<memoryContext>

Format Output: HANYA JSON:
{ "score": <0-100>, "feedback": "<evaluasi>", "plagiarismNote": "<catatan>" }
```

**User Content:**
```
Text: <extracted text from PDF/DOCX>
Images: <base64 page screenshots if available>
```

**Output Parsing:**
```typescript
function sanitizeLLMJson(raw: string): string {
  // Strip markdown code fences: ```json ... ```
  // Return clean JSON string
}

type AIGradingResult = {
  score: number;        // 0-100, clamped
  feedback: string;     // detailed evaluation
  plagiarismNote: string; // plagiarism findings
};
```

### Retry Mechanism

```typescript
async function callWithRetry<T>(fn, retries = 2, delay = 2500)
```

- Up to 3 total attempts (initial + 2 retries)
- Fixed 2.5s delay between retries
- Catches network errors, timeouts, and API failures

---

## Plagiarism Detection System

Three complementary detection mechanisms work together:

### 1. Exact Text Hash Detection

```
normalizeText(input):
  lower() -> replace(/[^a-z0-9\s]+/g, " ") -> collapse whitespace -> trim

hashNormalizedText(text):
  return SHA-256(normalizeText(text))
```

- **Purpose:** Catch identical submissions (copy-paste without changes)
- **Speed:** O(1) hash comparison
- **Evasion:** Easily bypassed by adding/removing spaces or minor edits

### 2. Shingle-Based Jaccard Similarity

```
normalizeText -> tokenize -> filter (length > 2) -> buildShingles(size=5)

buildShingles(tokens, size):
  for i = 0 to tokens.length - size:
    shingles.add(tokens[i..i+size].join(" "))

jaccardSimilarity(Set A, Set B):
  return |A ∩ B| / |A ∪ B|
```

- **Purpose:** Catch near-identical submissions with minor modifications
- **Shingle Size:** 5 tokens (configurable)
- **Threshold:** >= 0.7 (70% similarity)
- **False Positive Prevention:** Only flags at high similarity thresholds

### 3. Perceptual Image Hashing (dHash)

```
computeDHash(image):
  1. Resize to 9x8 grayscale
  2. gray = 0.299R + 0.587G + 0.114B
  3. For each row: compare adjacent pixels
     left > right -> bit = 1, else -> bit = 0
  4. 8 rows x 8 comparisons = 64 bits
  5. Encode as 16 hex characters

computeHammingDistance(hash1, hash2):
  return count of differing bits
```

- **Threshold:** Hamming distance <= 5 (out of 64)
- **Cross-validation with text similarity:**

| Image Matches | Required Jaccard | Reasoning |
|---|---|---|
| 3+ | >= 0.2 | Likely visual clone, minimal text overlap needed |
| 2 | >= 0.3 | Moderate text similarity required |
| 1 | >= 0.5 | Strong text similarity required (avoid template FPs) |

- **Purpose:** Detect copied screenshots, figures, or document layouts
- **Resilience:** Tolerates minor compression artifacts, resizing, and color changes

### Reverse Check

After grading a new assignment, all previously-graded assignments in the same task are re-checked against the new one. This catches cases where:

- Student A submits first (no duplicates exist yet)
- Student B submits later (forward check against A works)
- The reverse check ensures older assignments are also updated if the new one matches them

---

## Document Processing

### Supported Formats

| Format | Detection | Text Extraction | Image Extraction | Hash Computation |
|---|---|---|---|---|
| PDF | Magic bytes `%PDF` | pdf-parse | Page screenshots (scale 1.5x) | dHash on pages 2+ (skips cover) |
| DOCX | Magic bytes `PK` | mammoth extractRawText | Embedded images via mammoth convertToHtml | dHash on up to 3 images |

### Google Drive Integration

```typescript
extractDriveFileId(url: string): string {
  // Regex matches 25+ alphanumeric/hyphen/underscore chars
  const reg = /[-\w]{25,}/;
  return url.match(reg)[0];
}

downloadFileFromGoogleDrive(driveUrl: string): Promise<Buffer> {
  const fileId = extractDriveFileId(driveUrl);
  const downloadUrl = `https://drive.google.com/uc?export=download&confirm=no_antivirus&id=${fileId}`;
  const response = await fetch(downloadUrl);
  // Content-type check: if "text/html", Google returned an error page
  return Buffer.from(await response.arrayBuffer());
}
```

- Handles public Google Drive download URLs
- Detects HTML response (login wall, virus scan warning)
- Downloads entire file as Buffer for processing

### File Type Detection (Magic Bytes)

```typescript
detectFileType(buffer):
  - 0x25 0x50 0x44 0x46 -> "pdf"   (%PDF)
  - 0x50 0x4B 0x03 0x04 -> "docx"  (PK ZIP archive)
  - else -> "unknown"
```

---

## Queue System

A simple sequential queue (`services/queueService.ts`) processes assignments one at a time:

```typescript
class QueueService {
  private queue: string[] = [];
  private isProcessing = false;

  constructor() {
    // On server startup, reload unfinished assignments
    if (typeof window === "undefined") {
      this.initializeQueue();
    }
  }

  async initializeQueue() {
    // Find all pending/processing assignments
    // Reset them to "pending"
    // Enqueue each one
  }

  enqueue(assignmentId: string) {
    // Prevent duplicates
    // Add to queue
    // Trigger processing
  }

  private async processNext() {
    // Guard: one at a time
    // Shift from queue
    // Call processSubmission()
    // Wait 100ms, then process next
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export const queueService = new QueueService();
```

**Design Rationale:**
- Sequential processing (not parallel) prevents LLM overload on local hardware
- 100ms delay between items prevents thundering herd on database
- Queue is in-memory — on restart, unfinished assignments are reloaded from DB
- Singleton pattern exported as module-level instance

---

## API Design

### Route Map (25 endpoints)

```
Auth:
  POST /api/auth/register             - Register lecturer
  POST /api/auth/login                - Login
  POST /api/auth/logout               - Logout
  GET  /api/auth/me                   - Current user

Courses:
  GET  /api/courses                   - List courses (paginated)
  POST /api/courses                   - Create course
  DELETE /api/courses/[id]            - Delete course

Classes:
  POST /api/classes                   - Create class
  DELETE /api/classes/[id]            - Delete class

Tasks:
  POST /api/tasks                     - Create task
  GET  /api/tasks/[id]                - Task detail + assignments (paginated)
  PUT  /api/tasks/[id]                - Update task config
  POST /api/tasks/[id]/retry-failed   - Retry all failed assignments
  POST /api/tasks/[id]/rescan         - Rescan duplicates
  GET  /api/tasks/[id]/export         - Export grades as CSV

Assignments:
  GET  /api/assignments               - List all assignments (scoped to lecturer)
  GET  /api/assignments/[id]          - Assignment detail
  DELETE /api/assignments/[id]        - Delete assignment
  PATCH /api/assignments/[id]         - Manual grade override
  POST /api/assignments/[id]/retry    - Retry single assignment
  POST /api/assignments/[id]/duplicate - Mark as duplicate
  POST /api/assignments/[id]/confirm-plagiarism - Confirm/dismiss AI plagiarism

System:
  GET  /api/health                    - LM Studio connectivity check
  GET  /api/config                    - System configuration
  POST /api/config                    - Update system configuration

Integration:
  POST /api/webhook                   - Google Sheets Apps Script webhook
```

### Response Format

**Success:**
```json
{ "success": true, ...data }
```

**Error:**
```json
{ "error": "message" }
```
HTTP Status: 400 (validation), 401 (unauth), 403 (forbidden), 404 (not found), 500 (server error)

### Pagination

All list endpoints support:
```
?page=1&pageSize=25
```

Response includes:
```json
{
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 150,
    "totalPages": 6
  }
}
```

---

## Frontend Architecture

### Page Structure

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Dashboard - course/class/task CRUD |
| `/login` | `app/login/page.tsx` | Lecturer login |
| `/register` | `app/register/page.tsx` | Lecturer registration |
| `/tasks/[taskId]` | `app/tasks/[taskId]/page.tsx` | Task detail - grading results, config, actions |
| `/settings` | `app/settings/page.tsx` | System configuration |

### Component Tree

```
RootLayout
├── Toaster (sonner)
└── Page Content
    ├── Dashboard (/)
    │   ├── Health Indicator (LM Studio status)
    │   ├── Stats Cards (courses, classes, tasks)
    │   ├── Course Cards
    │   │   └── Class List
    │   │       └── Task List
    │   └── Modals (Course, Class, Task creation)
    │
    ├── TaskDetail (/tasks/[taskId])
    │   ├── StatusPanel (webhook info, status counts, Google Apps Script guide)
    │   ├── Configuration (rubric, window size, duplicate score)
    │   └── ResultsTable (assignment list, detail modal, plagiarism actions)
    │
    └── Settings (/settings)
        ├── Global Config (rubric, window size)
        ├── AI Config (base URL, model)
        ├── Duplicate Detection (thresholds)
        └── Security Info
```

### State Management

- Local `useState` + `useEffect` per page
- Auto-polling for task page (4s if active processing, 10s otherwise)
- No external state management library

### UI Framework

- **shadcn/ui primitives:** Button, Card, Input, Label, Textarea, Badge, Table
- **@base-ui/react:** Accessible component primitives (Button, Input)
- **Tailwind CSS 4** with CSS variables for theming
- **Dark theme** with oklch color space
- **tw-animate-css** for animation utilities
- **lucide-react** icons

---

## Deployment

### Docker Deployment

```yaml
# docker-compose.yml
services:
  app:
    container_name: gradely_app
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    ports:
      - "3045:3000"
    env_file:
      - .env
```

### Dockerfile (Multi-stage Build)

**Stage 1 - deps:** Install all dependencies in Alpine
**Stage 2 - builder:** Generate Prisma client, build Next.js standalone output
**Stage 3 - runner:** Production image with:

- Alpine-based (~150MB final image)
- Non-root user (`nextjs`, UID 1001) for container security
- Prisma + native modules re-installed (Next.js standalone tree-shakes them out)
- Healthcheck pings `/api/config` every 30s
- Entrypoint: wait for DB -> run migrations -> start server

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/config', \
    (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

### Entrypoint Script

```bash
1. Wait for database TCP connection (max 30 retries, 2s apart)
2. Run `npx prisma migrate deploy`
3. Start `node server.js`
```

### Build Configuration

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "pdfjs-dist", "mariadb"],
};
```

Native packages are excluded from bundling and loaded at runtime.

---

## Environment Configuration

```env
# === Database ===
DATABASE_URL="mysql://user:pass@host:3306/dbname"
DB_HOST=host
DB_PORT=3306
DB_USER=user
DB_PASSWORD=pass
DB_NAME=dbname

# === AI Provider ===
# Untuk LM Studio lokal:
#   AI_BASE_URL="http://localhost:1234/v1"
#   AI_API_KEY=""  (kosongkan untuk LM Studio)
#   AI_MODEL="google/gemma-4-e2b"
#
# Untuk 9Router / OpenRouter / API eksternal:
#   AI_BASE_URL="https://9router.com/v1"
#   AI_API_KEY="sk-your-api-key-here"
#   AI_MODEL="claude-sonnet-4-20250514"
AI_BASE_URL="http://localhost:1234/v1"
AI_API_KEY=""
AI_MODEL="google/gemma-4-e2b"

# === Webhook Authentication ===
WEBHOOK_SECRET="your-secret-token"

# === Session Security (optional) ===
SESSION_SECRET="your-hmac-secret"
```

### Dual Connection String Support

- `lib/db.ts` uses individual `DB_HOST/PORT/USER/PASSWORD/NAME` vars for MariaDB adapter
- `prisma.config.ts` and `seed.ts` use `DATABASE_URL` for Prisma CLI
- Both must be kept in sync

---

## Key Algorithms

### dHash (Difference Hash) for Images

```
1. Resize image to 9x8 pixels
2. Convert to grayscale using luminosity:
   gray = 0.299R + 0.587G + 0.114B
3. For each row (8 rows):
   For each adjacent pixel pair (8 pairs per row):
     if left > right -> bit = 1
     else -> bit = 0
4. Total: 8 rows x 8 comparisons = 64 bits
5. Group into 4-bit chunks, convert to hex:
   64 bits = 16 hex characters
6. Compare two hashes using Hamming distance:
   count differing bits
   lower distance = more visually similar
```

### Shingle-Based Jaccard Similarity

```
1. Normalize text:
   - Lowercase
   - Remove non-alphanumeric characters
   - Collapse whitespace
2. Tokenize (split by whitespace)
3. Filter tokens with length > 2
4. Build shingles using sliding window of size N (default: 5):
   shingle(i) = tokens[i] + " " + tokens[i+1] + ... + tokens[i+N-1]
5. Jaccard Similarity = |A ∩ B| / |A ∪ B|
   - Range: 0.0 (completely different) to 1.0 (identical)
   - Threshold for plagiarism: >= 0.7
```

### Sliding Window Memory

```
1. Get limit (default: 3) from Task.windowSize
2. Query: SELECT last N graded assignments WHERE taskId = X AND status = "done"
3. Order by createdAt DESC, take limit
4. For each assignment, format as:
   "TUGAS PEMBANDING #N:
    Nama Mahasiswa: <name>
    Nilai: <score>
    Potongan Isi Tugas:
    \"\"\"
    <extractedText truncated to 3000 chars>
    \"\"\"
    -----------------------------------------"
5. Join all entries with double newlines
6. Error fallback: return descriptive Indonesian message
7. Empty result: return "Belum ada tugas terdahulu yang dinilai sebagai pembanding."
```

---

## TypeScript Type Definitions

```typescript
// AI grading output structure
interface AIGradingResult {
  score: number;          // 0-100 integer
  feedback: string;       // Detailed evaluation in Indonesian
  plagiarismNote: string; // Plagiarism findings or empty string
}

// Full assignment record for API responses and frontend display
interface AssignmentRecord {
  id: string;
  studentName: string;
  fileName: string;
  extractedText: string;
  score: number | null;
  feedback: string | null;
  plagiarismNote: string | null;
  status: string;         // pending | processing | done | failed
  isDuplicate: boolean | null;
  duplicateOfId: string | null;
  duplicateReason: string | null;
  duplicateSimilarity: number | null;
  detectionSource: string | null;
  taskId: string;
  driveFileUrl: string | null;
  errorMessage: string | null;
  textHash: string | null;
  imageHashes: string | null;
  createdAt: Date;
  duplicateOf?: { id: string; studentName: string; extractedText?: string } | null;
  duplicates?: { id: string; studentName: string }[] | null;
}

// Sliding window context entry
interface SlidingWindowEntry {
  studentName: string;
  extractedText: string;
  score: number | null;
}

// Webhook payload from Google Apps Script (e.namedValues format)
interface WebhookPayload {
  Timestamp: string[];
  "Nama Mahasiswa": string[];
  "Upload Laporan (PDF)": string[];
  id_tugas: string[];
}

// Structured data parsed from raw webhook
interface ParsedSubmission {
  timestamp: string;
  studentName: string;
  driveFileUrl: string;
  taskId: string;
}

// Webhook processing job representation
interface SyncJob {
  id: string;
  status: "processing" | "done" | "error";
  studentName: string;
  taskId: string;
  error?: string;
}
```

---

## Development Setup

### Prerequisites

- Node.js 22+
- MySQL or MariaDB 8+
- LM Studio (or any OpenAI-compatible API endpoint) with a multimodal model loaded

### Installation

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd app-koreksi-ai-lokal
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your database credentials and AI endpoint

# 3. Setup database
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed

# 4. Start LM Studio
#    - Load a multimodal model (e.g., Gemma, LLaVA, Qwen-VL)
#    - Enable API server on http://localhost:1234

# 5. Start development server
npm run dev

# 6. Open browser
#    http://localhost:3000
#    Login: dosen@example.com / password123
```

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Production build |
| `npm start` | Start production server (after build) |
| `npm run lint` | Run ESLint |
| `npx prisma generate` | Generate Prisma client after schema changes |
| `npx prisma db seed` | Seed database with sample data |
| `npx prisma migrate dev` | Apply pending migrations |
| `npx prisma migrate deploy` | Apply migrations in production |

### Docker Development

```bash
# Build and run with Docker
docker compose up -d --build

# The app will be available at http://localhost:3045
# (mapped from container port 3000)
```

### Login Credentials (Seed Data)

| Email | Password | Role |
|---|---|---|
| dosen@example.com | password123 | Lecturer |
