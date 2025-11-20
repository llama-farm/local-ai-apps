export type Role = "user" | "assistant" | "system";

export type Message = {
  id: string;
  role: Role;
  content: string;
  citations?: Citation[];
};

export type Citation = {
  id: string;
  title?: string;
  source?: string;
  page?: number | string;
  score?: number;
  snippet?: string;
};

export type ChatRequest = {
  prompt: string;
  excerpts?: string[];
  topK?: number;
  ragEnabled?: boolean;
  scoreThreshold?: number;
  sessionId?: string;
};

export type StreamEvent = {
  token?: string;
  citations?: Citation[];
  done?: boolean;
  sessionId?: string;
};

export type ParsedPDF = {
  id: string;
  name: string;
  pages: number;
  textLength: number;
  chunks: string[];
};
