'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AiStreamingCursor } from './AiStreamingCursor';
import { cn } from '@/lib/utils';
import hljs from 'highlight.js';

interface AiMarkdownRendererProps {
  content: string;
  /** When true, appends a blinking cursor after the last token. */
  isStreaming?: boolean;
  className?: string;
}

/**
 * Renders AI markdown output as safe JSX — no dangerouslySetInnerHTML.
 * Supports GFM (tables, strikethrough, task lists), fenced code with
 * syntax highlighting via highlight.js, and opens external links safely.
 */
export function AiMarkdownRenderer({ content, isStreaming = false, className }: AiMarkdownRendererProps) {
  return (
    <div
      className={cn('prose prose-sm prose-invert max-w-none', className)}
      aria-live={isStreaming ? 'polite' : undefined}
      aria-atomic={isStreaming ? 'false' : undefined}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ── Headings ─────────────────────────────────────────────────
          h1: ({ children }) => (
            <h1 className="mb-3 mt-4 text-base font-bold text-zinc-100 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-3 text-sm font-semibold text-zinc-100 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1.5 mt-2 text-sm font-medium text-zinc-200 first:mt-0">{children}</h3>
          ),

          // ── Paragraphs ────────────────────────────────────────────────
          p: ({ children, node }) => {
            // For the very last paragraph, append the streaming cursor if needed.
            const isLastNode =
              isStreaming && node?.position?.end?.offset !== undefined;
            return (
              <p className="mb-2 text-sm leading-relaxed text-zinc-200 last:mb-0">
                {children}
                {isStreaming && isLastNode ? <AiStreamingCursor /> : null}
              </p>
            );
          },

          // ── Code ──────────────────────────────────────────────────────
          code: ({ className: langClass, children, ...rest }) => {
            const isBlock = 'node' in rest && (rest as any).node?.type === 'element';
            const match = /language-(\w+)/.exec(langClass ?? '');
            const lang = match ? match[1] : '';
            const raw = String(children).replace(/\n$/, '');

            if (langClass?.startsWith('language-') || raw.includes('\n')) {
              let highlighted = raw;
              try {
                if (lang && hljs.getLanguage(lang)) {
                  highlighted = hljs.highlight(raw, { language: lang }).value;
                } else {
                  highlighted = hljs.highlightAuto(raw).value;
                }
              } catch {
                // fall back to raw text
              }
              return (
                <pre className="my-2 overflow-x-auto rounded-lg border border-zinc-700/60 bg-zinc-950 p-3 text-xs leading-relaxed">
                  <code
                    className={cn('font-mono text-zinc-200', langClass)}
                    dangerouslySetInnerHTML={{ __html: highlighted }}
                  />
                </pre>
              );
            }

            // Inline code
            return (
              <code className="rounded bg-zinc-700/60 px-1 py-0.5 font-mono text-xs text-zinc-200">
                {children}
              </code>
            );
          },

          // ── Lists ─────────────────────────────────────────────────────
          ul: ({ children }) => (
            <ul className="mb-2 ml-4 list-disc space-y-1 text-sm text-zinc-200">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 ml-4 list-decimal space-y-1 text-sm text-zinc-200">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,

          // ── Blockquote ────────────────────────────────────────────────
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-zinc-600 pl-3 italic text-zinc-400">
              {children}
            </blockquote>
          ),

          // ── Links ─────────────────────────────────────────────────────
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
            >
              {children}
            </a>
          ),

          // ── Table ─────────────────────────────────────────────────────
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs text-zinc-200">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-zinc-700 bg-zinc-800 px-2 py-1 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border border-zinc-700 px-2 py-1">{children}</td>,

          // ── Horizontal Rule ───────────────────────────────────────────
          hr: () => <hr className="my-3 border-zinc-700" />,

          // ── Strong / Em ───────────────────────────────────────────────
          strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
          em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
      {/* Append cursor after the whole tree when content ends mid-stream and
          the last node isn't a paragraph (e.g. ends in a list item). */}
      {isStreaming && !content.endsWith('\n') && <AiStreamingCursor />}
    </div>
  );
}
