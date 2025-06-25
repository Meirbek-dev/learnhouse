'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useRef, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

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
          className="border-input bg-background shadow-2xs focus-within:border-ring/40 focus-within:outline-hidden ring-ring/8 dark:ring-ring/12 flex min-h-[38px] cursor-text flex-wrap items-center gap-1 rounded-lg p-1 transition-shadow focus-within:ring-[3px]"
          onClick={handleContainerClick}
        >
          {tags.map((tag, index) => (
            <span
              key={tag.id}
              className={`bg-background border-input hover:bg-background relative flex h-7 items-center rounded-md border pe-7 ps-2 text-xs font-medium ${
                activeTagIndex === index ? 'ring-ring/30 ring-2' : ''
              }`}
            >
              {tag.text}
              <button
                type="button"
                className="outline-hidden focus-visible:ring-ring/30 dark:focus-visible:ring-ring/40 text-muted-foreground/80 hover:text-foreground absolute -inset-y-px -end-px flex size-7 items-center justify-center rounded-e-lg p-0 transition-colors focus-visible:ring-2"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(index);
                }}
              >
                <X size={12} />
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
            className="focus-visible:outline-hidden h-7 w-full min-w-[80px] flex-1 border-none bg-transparent px-2 shadow-none"
          />
        </div>
        {error && <p className="text-destructive text-sm font-medium">{error}</p>}
      </div>
    </div>
  );
};

export default FormTagInput;
