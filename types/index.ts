export interface AIGradingResult {
  score: number;
  feedback: string;
  plagiarismNote: string;
}

export interface EvaluateRequest {
  studentName: string;
  file: File;
}

export interface AssignmentRecord {
  id: string;
  studentName: string;
  fileName: string;
  extractedText: string;
  score: number | null;
  feedback: string | null;
  plagiarismNote: string | null;
  taskId: string | null;
  driveFileUrl: string | null;
  status: string;
  errorMessage: string | null;
  isDuplicate?: boolean | null;
  duplicateOfId?: string | null;
  duplicateReason?: string | null;
  duplicateSimilarity?: number | null;
  duplicateOf?: {
    id: string;
    studentName: string;
  } | null;
  createdAt: Date;
}

export interface SlidingWindowEntry {
  studentName: string;
  extractedText: string;
  score: number | null;
}

// Webhook payload from Google Sheets Apps Script (e.namedValues format)
export interface WebhookPayload {
  Timestamp: string[];
  "Nama Mahasiswa": string[];
  "Upload Laporan (PDF)": string[];
  id_tugas: string[];
}

// Structured data parsed from raw webhook
export interface ParsedSubmission {
  timestamp: string;
  studentName: string;
  driveFileUrl: string;
  taskId: string;
}

// Webhook processing job representation for dashboard/tracking
export interface SyncJob {
  id: string;
  status: "processing" | "done" | "error";
  studentName: string;
  taskId: string;
  error?: string;
}
