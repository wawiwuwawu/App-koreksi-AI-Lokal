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
  createdAt: Date;
}

export interface SlidingWindowEntry {
  studentName: string;
  extractedText: string;
  score: number | null;
}
