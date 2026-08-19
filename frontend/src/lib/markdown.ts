import DOMPurify from 'dompurify';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

marked.setOptions({ gfm: true, breaks: false });

/** Model output -> safe HTML for chat bubbles and the rich text editor. */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown ?? '', { async: false }) as string;
  return DOMPurify.sanitize(html, { ADD_ATTR: ['style', 'colspan', 'rowspan'] });
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
});
turndown.use(gfm);
// Formatting markdown has no syntax for -> keep the tags so nothing is lost.
turndown.keep(['u', 'mark', 'sub', 'sup']);

/** Editor HTML -> markdown, so the .md export always matches what you see. */
export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html ?? '').trim() + '\n';
}

export function titleFromMarkdown(markdown: string, fallback = 'Untitled document'): string {
  const match = /^#\s+(.+)$/m.exec(markdown ?? '');
  return match ? match[1].trim() : fallback;
}
