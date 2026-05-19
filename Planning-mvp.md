# AI-Powered Automated Grading & Contextual Plagiarism Detection
**Project Type:** Minimum Viable Product (MVP) / Research Prototype  
**Goal:** Build a distributed system to automate student PDF report grading using Vision-Language Models (VLM). The system injects "Sliding Window Memory" to detect inter-student plagiarism (collusion).

---

## 1. TECH STACK & FRAMEWORK
- **Framework:** Next.js 14+ (App Router).
- **Language:** TypeScript (Strict mode enabled).
- **Database:** PostgreSQL.
- **ORM:** Prisma.
- **UI & Styling:** Tailwind CSS, `shadcn/ui`, `lucide-react`.
- **AI Integration:** Official `openai` Node.js SDK (configured to point to Local LM Studio endpoint or Google Gemini API).

---

## 2. PROJECT RULES & CONSTRAINTS
You (The AI Agent) MUST adhere to the following rules at all times:

1. **Strict Layered Architecture:**
   - **`/components` & `/app` (Presentation):** React UI only. NEVER call Prisma or external APIs directly from here.
   - **`/app/api` (Controllers):** Route handlers only. They parse requests, call services, and return responses. Keep them thin.
   - **`/services` (Business Logic):** ALL heavy lifting (PDF processing, AI calling, Context Memory fetching) MUST happen here.
   - **`/lib` or `/repositories`:** Database connection and direct Prisma queries.

2. **TypeScript Strictness:**
   - NO `any` types. 
   - Define exact interfaces/types for AI responses, function parameters, and API payloads.

3. **Core Concept: "Sliding Window Context" (Memory):**
   - LLMs are stateless. To detect plagiarism, the system must simulate memory.
   - Before evaluating a new assignment, fetch the last `N` (default: 3) graded assignments from the database.
   - Inject these previous assignments into the System Prompt as "Memory/Context" so the AI can compare the current student's work against recent peers.

4. **Structured Output Enforcement:**
   - The AI MUST return data in a strictly formatted JSON object: `{ "score": number, "feedback": string, "plagiarismNote": string }`. Use JSON mode or strong prompt engineering to enforce this.

5. **No Overengineering (MVP Scope):**
   - No complex authentication (Skip NextAuth).
   - No Vector Databases (Skip pgvector).
   - Focus strictly on the Upload -> Fetch Memory -> AI Evaluate -> Save to DB pipeline.

---

## 3. PRISMA SCHEMA DEFINITION
Use this exact schema to generate the database structure:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Assignment {
  id               String   @id @default(cuid())
  studentName      String
  fileName         String
  extractedText    String   @db.Text // Store full text/summary for sliding window memory
  score            Int?
  feedback         String?  @db.Text
  plagiarismNote   String?  @db.Text
  createdAt        DateTime @default(now())
}

model SystemConfig {
  id          String @id @default("default")
  rubric      String @db.Text
  windowSize  Int    @default(3) // Number of previous assignments to inject as memory
  updatedAt   DateTime @updatedAt
}

Phase 1: Foundation & Database
Initialize the Next.js project with TypeScript and Tailwind.

Setup Prisma, apply the schema provided above, and run the migration against the PostgreSQL instance.

Seed the SystemConfig table with a default rubric and windowSize of 3.

Phase 2: Service Layer Development
memoryService.ts: Create a function getSlidingWindowContext(limit: number) that fetches the latest graded Assignments from Prisma and formats them into a single string.

pdfService.ts: Create a function to handle PDF uploads, parse them, and extract either raw text or convert pages to Base64 (depending on the chosen VLM capabilities).

aiService.ts:

Setup the OpenAI client (pointing to the Local LM Studio endpoint, e.g., http://localhost:1234/v1).

Create evaluateAssignment(pdfData, studentName, memoryContext, rubric).

Ensure the prompt instructs the AI to use the memoryContext to detect copied patterns and return a JSON object.

Phase 3: API Controllers
Create POST /api/evaluate.

Flow:

Parse form data (Student Name, PDF File).

Fetch Rubric and Window Size from SystemConfig.

Call memoryService to get the context.

Call aiService with the payload + context.

Save the AI's JSON response to the Assignment table via Prisma.

Return 200 OK with the result.

Phase 4: Frontend (Dashboard UI)
Install necessary shadcn/ui components: Card, Button, Input, Table, Badge, Toast.

Build the main page (/app/page.tsx):

Left Column: A submission form containing a text input for Student Name, a file picker for the PDF, and a submit button with a loading state.

Right Column/Bottom: A real-time data table listing all graded assignments pulled from Prisma, displaying Name, Score, and Plagiarism flags.

Add basic error handling and toast notifications for success/failure states.