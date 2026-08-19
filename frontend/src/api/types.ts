export type DocType = 'doc' | 'sheet' | 'slides';
export type ExportFormat = 'md' | 'docx' | 'xlsx' | 'csv' | 'pptx' | 'html' | 'txt';

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  document_id?: string | null;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessage[];
}

/** Formatting applied to a spreadsheet cell. */
export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
  bg?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface SheetContent {
  headers: string[];
  rows: string[][];
  cellStyles: Record<string, CellStyle>;
  headerStyle?: CellStyle;
}

export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface Slide {
  id: string;
  title: string;
  layout: 'title' | 'bullets';
  subtitle?: string;
  bullets: string[];
  body?: string;
  notes?: string;
  titleStyle?: TextStyle;
  bodyStyle?: TextStyle;
}

export interface DeckContent {
  title: string;
  slides: Slide[];
}

export interface DocumentModel {
  id: string;
  conversation_id: string | null;
  title: string;
  doc_type: DocType;
  markdown: string;
  content_html: string | null;
  content_json: (SheetContent | DeckContent | Record<string, unknown>) | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentPatch {
  title?: string;
  doc_type?: DocType;
  markdown?: string;
  content_html?: string | null;
  content_json?: Record<string, unknown> | null;
}
