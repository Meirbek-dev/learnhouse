'use client';

import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';

interface RichContentRendererProps {
  content: string;
  className?: string;
}

export default function RichContentRenderer({ content, className = '' }: RichContentRendererProps) {
  // Sanitize the HTML content to prevent XSS attacks
  const sanitizedContent = typeof window !== 'undefined'
    ? DOMPurify.sanitize(content, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li',
          'blockquote',
          'a', 'img',
          'div', 'span',
          'iframe' // For YouTube embeds
        ],
        ALLOWED_ATTR: [
          'href', 'target', 'rel',
          'src', 'alt', 'width', 'height',
          'class', 'style',
          'frameborder', 'allowfullscreen', 'allow' // For YouTube embeds
        ],
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      })
    : content;

  return (
    <div
      className={cn(
        'prose prose-sm max-w-none',
        'prose-headings:font-semibold prose-headings:text-gray-900 prose-headings:mt-4 prose-headings:mb-2',
        'prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-2',
        'prose-strong:text-gray-900 prose-strong:font-semibold',
        'prose-em:text-gray-700 prose-em:italic',
        'prose-code:text-gray-900 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono',
        'prose-pre:bg-gray-100 prose-pre:text-gray-900 prose-pre:p-3 prose-pre:rounded-md prose-pre:overflow-x-auto prose-pre:my-3',
        'prose-blockquote:text-gray-700 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-3',
        'prose-ul:text-gray-700 prose-ul:list-disc prose-ul:list-outside prose-ul:ml-4 prose-ul:space-y-1 prose-ul:my-2',
        'prose-ol:text-gray-700 prose-ol:list-decimal prose-ol:list-outside prose-ol:ml-4 prose-ol:space-y-1 prose-ol:my-2',
        'prose-li:text-gray-700 prose-li:ml-0',
        'prose-a:text-blue-600 prose-a:hover:text-blue-800 prose-a:underline prose-a:break-words',
        'prose-img:max-w-full prose-img:h-auto prose-img:rounded-lg prose-img:my-3',
        // YouTube iframe styling
        '[&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-lg [&_iframe]:my-3',
        // Handle empty content
        'min-h-[1rem]',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
}
