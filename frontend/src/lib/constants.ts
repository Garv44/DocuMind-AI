import type { DocType, ExportFormat } from '../api/types';

export const FONT_FAMILIES = [
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Garamond', value: 'Garamond, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Consolas', value: 'Consolas, monospace' },
];

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 60, 72];

export const TEXT_COLORS = [
  '#111827', '#374151', '#6b7280', '#b91c1c', '#ea580c', '#ca8a04',
  '#15803d', '#0e7490', '#1d4ed8', '#6d28d9', '#be185d', '#ffffff',
];

export const HIGHLIGHT_COLORS = [
  '#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff', '#fed7aa',
];

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  doc: 'Word document',
  sheet: 'Spreadsheet',
  slides: 'Presentation',
};

export const DOC_TYPE_SHORT: Record<DocType, string> = {
  doc: 'Doc',
  sheet: 'Sheet',
  slides: 'Slides',
};

export const EXPORT_LABELS: Record<ExportFormat, string> = {
  md: 'Markdown (.md)',
  docx: 'Word (.docx)',
  xlsx: 'Excel (.xlsx)',
  csv: 'CSV (.csv)',
  pptx: 'PowerPoint (.pptx)',
  html: 'Web page (.html)',
  txt: 'Plain text (.txt)',
};

export const FALLBACK_FORMATS: Record<DocType, ExportFormat[]> = {
  doc: ['md', 'docx', 'html', 'txt', 'pptx'],
  sheet: ['xlsx', 'csv', 'md', 'docx'],
  slides: ['pptx', 'md', 'docx'],
};

export const COLUMN_LETTERS = (index: number): string => {
  let label = '';
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
};
