import type { Editor } from '@tiptap/react';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { styled } from 'styled-components';

interface TableOfContentsProps {
  editor: Editor | null;
}

interface HeadingItem {
  level: number;
  text: string;
  id: string;
}

const TableOfContents = ({ editor }: TableOfContentsProps) => {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!editor) return;

    const updateHeadings = () => {
      const items: HeadingItem[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name.startsWith('heading')) {
          const level = node.attrs.level || 1;
          const headingText = node.textContent || '';

          // Create slug from heading text (same logic as CustomHeading in DynamicCanva)
          const slug = headingText
            .toLowerCase()
            .trim()
            .replaceAll(/[^\s\w-]/g, '') // Remove special characters
            .replaceAll(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
            .replaceAll(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

          const id = slug ? `heading-${slug}` : `heading-${Math.random().toString(36).slice(2, 9)}`;

          items.push({
            level,
            text: node.textContent,
            id,
          });
        }
      });
      setHeadings(items);
    };

    editor.on('update', updateHeadings);
    updateHeadings();

    return () => {
      editor.off('update', updateHeadings);
    };
  }, [editor]);

  if (headings.length === 0) return <div style={{ display: 'none' }} />;

  return (
    <TOCCard>
      <TOCList>
        {headings.map((heading, index) => (
          <TOCItem
            key={index}
            level={heading.level}
          >
            <span className="toc-check">
              <Check
                size={15}
                strokeWidth={1.7}
              />
            </span>
            <a
              className={`toc-link toc-link-h${heading.level}`}
              href={`#${heading.id}`}
            >
              {heading.text}
            </a>
          </TOCItem>
        ))}
      </TOCList>
    </TOCCard>
  );
};

const TOCCard = styled.div`
  width: 100%;
  background: none;
  border: none;
  box-shadow: none;
  padding: 0;
  margin: 0;
  font-family: inherit;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  height: fit-content;
`;

const TOCList = styled.ul`
  list-style: none !important;
  padding: 0 !important;
  margin: 0;
`;

const TOCItem = styled.li<{ level: number }>`
  margin: 0.5rem 0;
  padding-left: ${({ level }) => `${(level - 1) * 1.2}rem`};
  list-style: none !important;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;

  .toc-check {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    margin-top: 0.1rem;
    color: #23272f;
  }

  .toc-link {
    display: block;
    flex: 1;
    min-width: 0;
    padding: 0;
    color: #23272f;
    font-weight: ${({ level }) => (level === 1 ? 500 : 400)};
    font-size: ${({ level }) => (level === 1 ? '1rem' : level === 2 ? '0.97rem' : '0.95rem')};
    line-height: 1.4;
    text-decoration: none;
    word-break: break-word;
    hyphens: auto;
    background: none;
    border-radius: 0;
    transition: none;

    &:hover {
      color: #007acc;
    }
  }
`;

export default TableOfContents;
