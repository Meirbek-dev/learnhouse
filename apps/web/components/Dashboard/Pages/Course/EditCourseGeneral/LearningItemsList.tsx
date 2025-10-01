'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EmojiClickData } from 'emoji-picker-react';
import { Link as LinkIcon, Plus, X } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import { generateUUID } from '@/lib/utils';

interface LearningItem {
  id: string;
  text: string;
  emoji: string;
  link?: string;
}

interface LearningItemsListProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const LearningItemsList = ({ value, onChange, error }: LearningItemsListProps) => {
  const [items, setItems] = useState<LearningItem[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showLinkInput, setShowLinkInput] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const linkInputFieldRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const t = useTranslations('CourseEdit.General.LearningItems');

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Parse and validate incoming value - CRITICAL: Don't include items in dependencies to avoid infinite loop
  useEffect(() => {
    // Skip if already initialized and value hasn't changed from what we set
    if (initializedRef.current) {
      return;
    }

    try {
      if (value) {
        const parsedItems = JSON.parse(value);
        if (Array.isArray(parsedItems) && parsedItems.length > 0) {
          // Standardize items from the value prop
          const newStandardizedItems: LearningItem[] = parsedItems.map((item: unknown) => {
            const safeItem = item as Partial<LearningItem>;
            return {
              id: safeItem.id || generateUUID(),
              text: safeItem.text ?? '',
              emoji: safeItem.emoji || '📝',
              link: safeItem.link || undefined,
            };
          });

          setItems(newStandardizedItems);
          // Sync back to parent if we generated IDs
          const needsSync = newStandardizedItems.some(
            (item, idx) => !parsedItems[idx]?.id || item.id !== parsedItems[idx]?.id,
          );
          if (needsSync) {
            onChange(JSON.stringify(newStandardizedItems));
          }
          initializedRef.current = true;
        } else {
          // Invalid array or empty - initialize with default
          const defaultItem: LearningItem = {
            id: generateUUID(),
            text: '',
            emoji: '📝',
          };
          setItems([defaultItem]);
          onChange(JSON.stringify([defaultItem]));
          initializedRef.current = true;
        }
      } else {
        // No value provided - initialize with default
        const defaultItem: LearningItem = {
          id: generateUUID(),
          text: '',
          emoji: '📝',
        };
        setItems([defaultItem]);
        onChange(JSON.stringify([defaultItem]));
        initializedRef.current = true;
      }
    } catch (error) {
      console.error('Error parsing learning items:', error);
      // Fallback to default item on error
      const defaultItem: LearningItem = {
        id: generateUUID(),
        text: '',
        emoji: '📝',
      };
      setItems([defaultItem]);
      onChange(JSON.stringify([defaultItem]));
      initializedRef.current = true;
    }
  }, [value, onChange]);

  // Add a new empty item
  const addItem = useCallback(() => {
    const newItem: LearningItem = {
      id: generateUUID(),
      text: '',
      emoji: '📝',
    };
    const newItems = [...items, newItem];
    setItems(newItems);
    onChange(JSON.stringify(newItems));

    // Use timeout to ensure DOM has updated
    const timeoutId = setTimeout(() => {
      if (!isMountedRef.current) return;

      const inputEl = inputRefs.current[newItem.id];
      if (inputEl) {
        inputEl.focus();
        setFocusedItemId(newItem.id);
      }

      const scrollEl = scrollContainerRef.current;
      if (scrollEl && newItems.length > 5) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [items, onChange]);

  // Remove an item
  const removeItem = useCallback(
    (id: string) => {
      if (focusedItemId === id) {
        setFocusedItemId(null);
      }
      const newItems = items.filter((item) => item.id !== id);
      setItems(newItems);
      onChange(JSON.stringify(newItems));
    },
    [items, focusedItemId, onChange],
  );

  const updateItemText = useCallback(
    (id: string, text: string) => {
      const newItems = items.map((item) => (item.id === id ? { ...item, text } : item));
      setItems(newItems);
      onChange(JSON.stringify(newItems));
    },
    [items, onChange],
  );

  const updateItemEmoji = useCallback(
    (id: string, emoji: string) => {
      const newItems = items.map((item) => (item.id === id ? { ...item, emoji } : item));
      setItems(newItems);
      onChange(JSON.stringify(newItems));
      setShowEmojiPicker(null);

      const timeoutId = setTimeout(() => {
        if (!isMountedRef.current) return;

        const inputEl = inputRefs.current[id];
        if (inputEl) {
          inputEl.focus();
          setFocusedItemId(id);
        }
      }, 0);

      return () => clearTimeout(timeoutId);
    },
    [items, onChange],
  );

  // Update item link
  const updateItemLink = useCallback(
    (id: string, link: string) => {
      const newItems = items.map((item) => (item.id === id ? { ...item, link: link.trim() || undefined } : item));
      setItems(newItems);
      onChange(JSON.stringify(newItems));
    },
    [items, onChange],
  );

  // Restore focus after re-render if an item was focused
  useEffect(() => {
    if (!focusedItemId || !isMountedRef.current) return;

    const timeoutId = setTimeout(() => {
      if (!isMountedRef.current) return;

      if (showLinkInput === focusedItemId) {
        linkInputFieldRefs.current[focusedItemId]?.focus();
      } else {
        inputRefs.current[focusedItemId]?.focus();
      }

      // Handle scrolling for long lists
      if (items.length > 5) {
        const scrollEl = scrollContainerRef.current;
        const focusedEl = document.getElementById(`learning-item-${focusedItemId}`);

        if (scrollEl && focusedEl) {
          const containerRect = scrollEl.getBoundingClientRect();
          const elementRect = focusedEl.getBoundingClientRect();

          if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
            focusedEl.scrollIntoView({
              block: 'nearest',
              behavior: 'smooth',
            });
          }
        }
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [focusedItemId, showLinkInput, items.length]);

  // Handle clicks outside of emoji picker and link input
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Close emoji picker if clicking outside
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        setShowEmojiPicker(null);
      }

      // Close link input if clicking outside (but not on the link icon itself)
      if (linkInputRef.current && !linkInputRef.current.contains(target)) {
        const clickedLinkIcon = target.closest('[data-role="link-icon"]');
        const linkInputItemId = target.closest('[data-itemid]')?.getAttribute('data-itemid');

        // Only close if not clicking the link icon for the currently open link input
        if (!clickedLinkIcon || linkInputItemId !== showLinkInput) {
          setShowLinkInput(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLinkInput]);

  const handleEmojiSelect = useCallback(
    (id: string, emojiData: EmojiClickData) => {
      updateItemEmoji(id, emojiData.emoji);
    },
    [updateItemEmoji],
  );

  const handleInputFocus = (id: string) => {
    setFocusedItemId(id);
  };

  const handleInputBlur = () => {
    const timeoutId = setTimeout(() => {
      if (!isMountedRef.current) return;

      const activeEl = document.activeElement;
      const isStillInComponent =
        activeEl?.classList.contains('learning-item-input') || activeEl?.closest('[data-emoji-picker="true"]');

      if (!isStillInComponent) {
        setShowLinkInput(null);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  };

  const setInputRef = (id: string) => (el: HTMLInputElement | null) => {
    inputRefs.current[id] = el;
  };

  const setLinkInputRef = (id: string) => (el: HTMLInputElement | null) => {
    linkInputFieldRefs.current[id] = el;
  };

  const isScrollable = items.length > 5;

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <div className="rounded-lg bg-gray-50/50 py-3 text-center text-sm text-gray-500">{t('noItems')}</div>
      )}

      <div
        ref={scrollContainerRef}
        className={`space-y-2 ${isScrollable ? 'scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent max-h-[350px] overflow-y-auto pr-1' : ''}`}
      >
        {items.map((item) => (
          <div
            key={item.id}
            id={`learning-item-${item.id}`}
            className="group relative"
          >
            <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2 transition-colors hover:bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  setShowEmojiPicker((prev) => (prev === item.id ? null : item.id));
                  setShowLinkInput(null);
                  setFocusedItemId(item.id);
                }}
                className="shrink-0 text-lg transition-transform hover:scale-110"
                aria-label={t('changeEmojiAriaLabel')}
              >
                <span>{item.emoji}</span>
              </button>

              <Input
                ref={setInputRef(item.id)}
                value={item.text}
                onChange={(e) => {
                  updateItemText(item.id, e.target.value);
                }}
                onFocus={() => {
                  handleInputFocus(item.id);
                }}
                onBlur={handleInputBlur}
                placeholder={t('placeholder')}
                className="learning-item-input h-8 grow border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
              />

              {item.link ? (
                <div className="flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-500">
                  <LinkIcon size={12} />
                  <span className="max-w-[100px] truncate">{item.link}</span>
                </div>
              ) : null}

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-itemid={item.id}
                  data-role="link-icon"
                  onClick={() => {
                    const isOpening = showLinkInput !== item.id;
                    setShowLinkInput(isOpening ? item.id : null);
                    setShowEmojiPicker(null);
                    setFocusedItemId(item.id);

                    if (isOpening) {
                      setTimeout(() => {
                        if (isMountedRef.current) {
                          linkInputFieldRefs.current[item.id]?.focus();
                        }
                      }, 0);
                    }
                  }}
                  className="text-gray-400 transition-colors hover:text-blue-500"
                  title={item.link ? t('editLinkTooltip') : t('addLinkTooltip')}
                  aria-label={item.link ? t('editLinkAriaLabel') : t('addLinkAriaLabel')}
                >
                  <LinkIcon size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    removeItem(item.id);
                  }}
                  className="text-gray-300 transition-colors hover:text-gray-500"
                  aria-label={t('removeItemAriaLabel')}
                  title={t('removeItemTooltip')}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {showEmojiPicker === item.id && (
              <div
                ref={pickerRef}
                className="absolute left-0 z-10 mt-1 shadow-lg"
                data-emoji-picker="true"
              >
                <EmojiPicker
                  height="25rem"
                  width="25rem"
                  onEmojiClick={(emoji) => {
                    handleEmojiSelect(item.id, emoji);
                  }}
                  theme={Theme.LIGHT}
                  previewConfig={{ showPreview: false }}
                  searchPlaceHolder={t('searchEmojis')}
                  autoFocusSearch
                  skinTonesDisabled
                />
              </div>
            )}

            {showLinkInput === item.id && (
              <div
                ref={linkInputRef}
                className="mt-1 rounded-lg border border-gray-200 bg-white p-2 shadow-sm"
              >
                <Input
                  ref={setLinkInputRef(item.id)}
                  type="url"
                  value={item.link || ''}
                  onChange={(e) => {
                    updateItemLink(item.id, e.target.value);
                  }}
                  onFocus={() => {
                    handleInputFocus(item.id);
                  }}
                  onBlur={handleInputBlur}
                  placeholder={t('linkInputPlaceholder')}
                  className="learning-item-input w-full text-sm"
                  aria-label={t('linkInputAriaLabel')}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addItem}
        className="mt-2 flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700"
      >
        <Plus
          size={16}
          className="text-primary"
        />
        <span>{t('addItemButton')}</span>
      </button>
    </div>
  );
};

export default LearningItemsList;
