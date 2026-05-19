# STRICT PROJECT INSTRUCTIONS & CONSTRAINTS FOR AI AGENT

## [0] SYSTEM PERSONA & CONTEXT
- **Role:** You are an Expert Full-Stack TypeScript Developer, Software Architect, and AI Integration Specialist.
- **Project:** "AI-Powered Automated Grading System with Contextual Memory".
- **Goal:** Build a production-ready, MVP prototype to grade student PDF assignments using Local Vision-Language Models (LM Studio/Gemma) with a "Sliding Window" memory technique to detect plagiarism.

## [1] TECH STACK RESTRICTIONS
You MUST ONLY use the following technologies. DO NOT introduce new frameworks or major libraries without asking the human first.
- **Core:** Next.js 14+ (App Router), React, TypeScript.
- **Styling:** Tailwind CSS, `shadcn/ui`, `lucide-react`.
- **Database:** PostgreSQL, Prisma ORM.
- **AI Integration:** `openai` (Official Node.js SDK, configured for Local LM Studio).
- **Forms & Validation:** `react-hook-form`, `zod`.

## [2] ARCHITECTURE & FILE STRUCTURE (STRICT)
You MUST adhere to a strict Layered Architecture. Separation of concerns is non-negotiable.
- **`/app` & `/components` (Presentation Layer):**
  - NEVER write database queries (Prisma) here.
  - NEVER write complex AI logic here.
  - Only handle UI rendering, state, and calling `/api` routes.
- **`/app/api` (Controller Layer):**
  - Keep route handlers thin.
  - Parse requests, validate with Zod, call the Service layer, and return HTTP responses.
- **`/services` (Business Logic Layer):**
  - ALL core logic lives here (`aiService.ts`, `memoryService.ts`, `pdfService.ts`).
  - This is where Sliding Window Memory is constructed and where the AI SDK is called.
- **`/lib/db.ts` (Data Access):**
  - Single instance of Prisma Client to prevent connection leaks.

## [3] TYPESCRIPT & NEXT.JS BEST PRACTICES
- **TypeScript:** Strict mode is ON. 
  - NEVER use `any`. You MUST define exact `interface` or `type` for all variables, function parameters, and API responses.
  - NEVER ignore TypeScript errors (no `@ts-ignore` unless absolutely necessary and documented).
- **Next.js App Router:**
  - Default to **React Server Components (RSC)**.
  - Only add `"use client"` at the very top of files that require browser APIs or hooks (`useState`, `useEffect`, `onClick`).
  - Keep client components as small as possible (push logic down the tree).

## [4] AI & LOGIC CONSTRAINTS (SLIDING WINDOW & LLM)
- **Local AI Endpoint:** Configure the `openai` client to use `http://localhost:1234/v1` (or dynamic ENV variable) instead of OpenAI's default URL.
- **Sliding Window Implementation:**
  - Before evaluating a new assignment, query the DB for the last `windowSize` (e.g., 3-5) assignments.
  - Inject these texts/summaries into the System Prompt as Context.
- **Structured Output (JSON):**
  - The AI MUST return a JSON object. 
  - **Sanitization Rule:** Local LLMs often wrap JSON in Markdown blocks (e.g., ` ```json { ... } 
``` `). You MUST write a utility function in `aiService.ts` to strip these markdown ticks before running `JSON.parse()`.
  - Required JSON schema: `{ "score": number, "feedback": string, "plagiarismNote": string }`.

## [5] DATABASE & PRISMA RULES
- ALWAYS use asynchronous Prisma queries (`await prisma...`).
- Handle database errors gracefully. If Prisma fails, the API must return a `500 Internal Server Error` with a safe error message, not crash the app.
- Do not expose sensitive DB information to the frontend.

## [6] UI/UX & STYLING RULES
- Use `shadcn/ui` components for all standard UI elements (Buttons, Inputs, Cards, Tables, Toasts).
- Ensure the layout is responsive using standard Tailwind breakpoints.
- Provide clear loading states (e.g., disable buttons, show spinners) when waiting for AI responses, as local LLM inference can take 10-60 seconds.
- Use Toast notifications for success/error alerts.

## [7] AI AGENT BEHAVIORAL RULES (HOW YOU MUST WORK)
1. **Step-by-Step Execution:** DO NOT write the entire application at once. Write the code in logical phases (Database -> Services -> API -> UI) and wait for human confirmation between phases.
2. **Do Not Hallucinate:** If you do not know how a specific library works in this context, look up the documentation or ask the human.
3. **Refactoring:** If a file exceeds 300 lines of code, pause and suggest extracting components or utility functions to keep the codebase clean.
4. **Commenting:** Leave brief, clear comments explaining the *why*, especially in the Sliding Window logic and AI prompt construction.

**IF YOU UNDERSTAND THESE RULES, REPLY WITH "RULES ACKNOWLEDGED" AND WAIT FOR THE FIRST TASK.**

# TASK: Implement Google Sheets Webhook Integration for AI Grading System

## [8] CONTEXT & GOAL
You are continuing the development of the "AI-Powered Automated Grading System". 
**Current Task:** Build the API Webhook endpoint (`POST /api/webhook`) that receives automated HTTP requests from a Google Sheets Apps Script trigger whenever a student submits a Google Form. 

## [9] INCOMING PAYLOAD SPECIFICATION
The data coming from Google Sheets via `e.namedValues` wraps all values inside ARRAYS. The webhook must parse this specific structure.
**Example Incoming JSON Body:**
```json
{
  "Timestamp": ["5/19/2026 12:05:00"],
  "Nama Mahasiswa": ["Budi Santoso"],
  "Upload Laporan (PDF)": ["[https://drive.google.com/open?id=1a2b3c4d5e](https://drive.google.com/open?id=1a2b3c4d5e)..."],
  "id_tugas": ["TASK-001"]
}

[2] ARCHITECTURE & FILE TARGETS
You must modify or create the following files while adhering to the Strict Layered Architecture:

Controller Layer: app/api/webhook/route.ts

Create a POST handler.

Extract the strings from the arrays (e.g., body["Nama Mahasiswa"][0]).

Service Layer (PDF): services/pdfService.ts

Add a utility function to handle Google Drive URLs.

Convert the Google Drive "view" link into a "direct download" link.

Download the PDF into a temporary buffer/file.

Service Layer (Core): services/gradingPipeline.ts (or update existing aiService.ts)

Orchestrate the flow: Download PDF -> Extract Text/Base64 -> Fetch Memory (Sliding Window) -> Call LLM -> Save to DB.

[3] STRICT RULES FOR THIS TASK
Google Drive URL Parsing: Google Forms outputs Drive links. You MUST write a regex or URL parser in pdfService.ts to extract the File ID and construct a direct download URL (e.g., https://drive.google.com/uc?export=download&id=FILE_ID).

Type Safety: Define an interface for the incoming webhook payload. Do not use any.

Graceful Error Handling: If the Google Drive link is private or invalid, the API must catch the error, save the status as "Failed" in the database, and return a 400 or 500 status without crashing the server.

Integration with Existing Services: This webhook is just a new entry point. Once the PDF is downloaded, you MUST reuse the existing aiService.ts and memoryService.ts (Sliding Window Context) that were built in the previous phase.

[4] STEP-BY-STEP EXECUTION PLAN
Execute these steps in order:

Step 1: Create Payload Types & Route Handler

Create the POST endpoint at /app/api/webhook/route.ts.

Write the TypeScript interface for the Google Sheets payload.

Extract studentName, driveLink, and taskId from index [0] of their respective arrays.

Step 2: Implement Google Drive Downloader

Open services/pdfService.ts.

Write downloadFileFromGoogleDrive(driveUrl: string): Promise<Buffer>.

Note: Assume the Google Drive folder is set to "Anyone with the link can view". Use native fetch to download the file into a buffer.

Step 3: Wire the Pipeline

Inside the webhook route, pass the downloaded PDF buffer and student name to the existing AI grading pipeline.

Wait for the AI response and save it to Prisma.

Return  NextResponse.json({ success: true }).

IF YOU UNDERSTAND THESE REQUIREMENTS, PLEASE PROCEED WITH STEP 1.

Berikut adalah rancangan tugas (Action Plan) khusus untuk fitur **Integrasi Webhook Google Sheet**. Anda bisa langsung menyalin blok teks di bawah ini dan memberikannya kepada AI *coding agent* Anda (seperti Cursor atau Cline) sebagai kelanjutan dari tugas sebelumnya.

Rancangan ini akan memberi tahu AI bahwa *endpoint* yang dibangun harus bisa membaca format data spesifik dari Google Apps Script dan menangani tautan Google Drive.

---

```markdown
# TASK: Implement Google Sheets Webhook Integration for AI Grading System

## [0] CONTEXT & GOAL
You are continuing the development of the "AI-Powered Automated Grading System". 
**Current Task:** Build the API Webhook endpoint (`POST /api/webhook`) that receives automated HTTP requests from a Google Sheets Apps Script trigger whenever a student submits a Google Form. 

## [1] INCOMING PAYLOAD SPECIFICATION
The data coming from Google Sheets via `e.namedValues` wraps all values inside ARRAYS. The webhook must parse this specific structure.
**Example Incoming JSON Body:**
```json
{
  "Timestamp": ["5/19/2026 12:05:00"],
  "Nama Mahasiswa": ["Budi Santoso"],
  "Upload Laporan (PDF)": ["[https://drive.google.com/open?id=1a2b3c4d5e](https://drive.google.com/open?id=1a2b3c4d5e)..."],
  "id_tugas": ["TASK-001"]
}

```

## [2] ARCHITECTURE & FILE TARGETS

You must modify or create the following files while adhering to the Strict Layered Architecture:

1. **Controller Layer:** `app/api/webhook/route.ts`
* Create a `POST` handler.
* Extract the strings from the arrays (e.g., `body["Nama Mahasiswa"][0]`).


2. **Service Layer (PDF):** `services/pdfService.ts`
* Add a utility function to handle Google Drive URLs.
* Convert the Google Drive "view" link into a "direct download" link.
* Download the PDF into a temporary buffer/file.


3. **Service Layer (Core):** `services/gradingPipeline.ts` (or update existing `aiService.ts`)
* Orchestrate the flow: Download PDF -> Extract Text/Base64 -> Fetch Memory (Sliding Window) -> Call LLM -> Save to DB.



## [3] STRICT RULES FOR THIS TASK

1. **Google Drive URL Parsing:** Google Forms outputs Drive links. You MUST write a regex or URL parser in `pdfService.ts` to extract the File ID and construct a direct download URL (e.g., `https://drive.google.com/uc?export=download&id=FILE_ID`).
2. **Type Safety:** Define an interface for the incoming webhook payload. Do not use `any`.
3. **Graceful Error Handling:** If the Google Drive link is private or invalid, the API must catch the error, save the status as "Failed" in the database, and return a `400` or `500` status without crashing the server.
4. **Integration with Existing Services:** This webhook is just a new entry point. Once the PDF is downloaded, you MUST reuse the existing `aiService.ts` and `memoryService.ts` (Sliding Window Context) that were built in the previous phase.

## [4] STEP-BY-STEP EXECUTION PLAN

Execute these steps in order:

**Step 1: Create Payload Types & Route Handler**

* Create the `POST` endpoint at `/app/api/webhook/route.ts`.
* Write the TypeScript interface for the Google Sheets payload.
* Extract `studentName`, `driveLink`, and `taskId` from index `[0]` of their respective arrays.

**Step 2: Implement Google Drive Downloader**

* Open `services/pdfService.ts`.
* Write `downloadFileFromGoogleDrive(driveUrl: string): Promise<Buffer>`.
* Note: Assume the Google Drive folder is set to "Anyone with the link can view". Use native `fetch` to download the file into a buffer.

**Step 3: Wire the Pipeline**

* Inside the webhook route, pass the downloaded PDF buffer and student name to the existing AI grading pipeline.
* Wait for the AI response and save it to Prisma.
* Return ` NextResponse.json({ success: true })`.

**IF YOU UNDERSTAND THESE REQUIREMENTS, PLEASE PROCEED WITH STEP 1.**

```

### Catatan Penting Sebelum Menjalankan Ini:
Untuk memastikan *script* dari AI agent nanti bisa benar-benar mengunduh file PDF mahasiswa, Anda harus memastikan bahwa **folder Google Drive tempat Google Form menyimpan file unggahan (PDF) sudah disetel menjadi "Anyone with the link can view" (Siapa saja yang memiliki tautan dapat melihat)**. 

Jika folder tersebut masih *Private* (hanya Anda yang bisa mengakses), *backend* Next.js Anda akan diblokir oleh Google saat mencoba mengunduh file tersebut, karena *backend* Anda tidak memiliki *session login* Google Anda.

```