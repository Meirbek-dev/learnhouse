'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useRef, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormTagInputProps {
  value: string;
  onChange: (value: string) => void;
  separator?: string;
  error?: string;
  placeholder?: string;
}

interface Tag {
  id: string;
  text: string;
}

const FormTagInput = ({ value, onChange, separator = ' | ', error, placeholder }: FormTagInputProps) => {
  const t = useTranslations('General');
  const [tags, setTags] = useState<Tag[]>(() =>
    value && typeof value === 'string'
      ? value
          .split(separator)
          .filter((text) => text.trim())
          .map((text, i) => ({ id: i.toString(), text: text.trim() }))
      : [],
  );
  const [inputValue, setInputValue] = useState('');
  const [activeTagIndex, setActiveTagIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value && typeof value === 'string') {
      const newTags = value
        .split(separator)
        .filter((text) => text.trim())
        .map((text, i) => ({ id: i.toString(), text: text.trim() }));
      setTags(newTags);
    } else {
      setTags([]);
    }
  }, [value, separator]);

  const handleTagsChange = (newTags: Tag[]) => {
    setTags(newTags);
    onChange(newTags.map((tag) => tag.text).join(separator));
  };

  const addTag = (text: string) => {
    const trimmedText = text.trim();
    if (trimmedText && !tags.some((tag) => tag.text === trimmedText)) {
      const newTag = { id: Date.now().toString(), text: trimmedText };
      handleTagsChange([...tags, newTag]);
    }
    setInputValue('');
  };

  const removeTag = (indexToRemove: number) => {
    handleTagsChange(tags.filter((_, index) => index !== indexToRemove));
    setActiveTagIndex(null);
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      if (activeTagIndex !== null) {
        removeTag(activeTagIndex);
        setActiveTagIndex(null);
      } else {
        setActiveTagIndex(tags.length - 1);
      }
    } else if (e.key === 'Escape') {
      setActiveTagIndex(null);
    }
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div>
      <div className="space-y-2">
        <div
          className={cn(
            "flex min-h-9 cursor-text flex-wrap items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/50",
            error && "border-destructive focus-within:ring-destructive/40",
          )}
          onClick={handleContainerClick}
          tabIndex={0}
          aria-invalid={!!error}
        >
          {tags.map((tag, index) => (
            <span
              key={tag.id}
              className={cn(
                "inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground mr-1 gap-1 border border-muted-foreground/10",
                activeTagIndex === index && "ring-2 ring-primary/60"
              )}
            >
              {tag.text}
              <button
                type="button"
                tabIndex={-1}
                aria-label={t('removeTag', { tag: tag.text })}
                className="ml-1 rounded hover:bg-muted-foreground/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(index);
                }}
              >
                <X size={12} className="text-muted-foreground" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={tags.length === 0 ? placeholder || t('placeholderTags') : ''}
            className={cn(
              "flex-1 bg-transparent outline-none border-none p-0 m-0 min-w-[60px] text-sm text-foreground placeholder:text-muted-foreground",
              "focus-visible:ring-0 focus-visible:outline-none"
            )}
            aria-label={t('addTag')}
          />
        </div>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
    </div>
  );
};

export default FormTagInput;
