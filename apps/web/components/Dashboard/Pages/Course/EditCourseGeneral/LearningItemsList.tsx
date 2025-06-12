'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, X, Link as LinkIcon } from 'lucide-react'
import EmojiPicker, { Theme } from 'emoji-picker-react'
import { Input } from '@components/ui/input' // Assuming this path is correct
import { useTranslations } from 'next-intl'

interface LearningItem {
  id: string
  text: string
  emoji: string
  link?: string
}

interface LearningItemsListProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

const LearningItemsList = ({
  value,
  onChange,
  error,
}: LearningItemsListProps) => {
  const [items, setItems] = useState<LearningItem[]>([])
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const [showLinkInput, setShowLinkInput] = useState<string | null>(null)
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const linkInputRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const linkInputFieldRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('CourseEdit.General.LearningItems')

  // Parse the JSON string to items array when the component mounts or value changes
  useEffect(() => {
    try {
      if (value) {
        const parsedItems = JSON.parse(value)
        if (Array.isArray(parsedItems)) {
          // Standardize items from the value prop
          const newStandardizedItems = parsedItems.map((item: any) => ({
            id: item.id || Date.now().toString(),
            text: item.text ?? '', // Use nullish coalescing for text
            emoji: item.emoji || '📝',
            link: item.link, // Preserve undefined, null, or ""
          }))

          // Check if the current internal state `items` is different from newStandardizedItems
          const itemsNeedUpdate =
            items.length !== newStandardizedItems.length ||
            items.some((oldItem, index) => {
              const newItem = newStandardizedItems[index]
              if (!newItem) return true // Should not happen if lengths match
              return (
                oldItem.id !== newItem.id ||
                oldItem.text !== newItem.text ||
                oldItem.emoji !== newItem.emoji ||
                oldItem.link !== newItem.link
              )
            })

          if (itemsNeedUpdate) {
            setItems(newStandardizedItems)
            // If the items were updated (potentially due to standardization like new IDs),
            // ensure the parent gets this new canonical version.
            // This is crucial to prevent re-generating IDs on subsequent renders.
            onChange(JSON.stringify(newStandardizedItems))
          }
          initializedRef.current = true
        } else if (!initializedRef.current) {
          // Value is truthy, but not a parsable array, and we haven't initialized.
          console.warn(
            `LearningItemsList: Initial value (typeof: ${typeof value}, value: "${String(
              value
            ).substring(
              0,
              50
            )}") is not a valid JSON array. Initializing with a default item.`
          )
          const newItem: LearningItem = {
            id: Date.now().toString(),
            text: '',
            emoji: '📝',
          }
          const defaultPayload = [newItem]
          const defaultJSON = JSON.stringify(defaultPayload)

          setItems(defaultPayload) // Set items first
          onChange(defaultJSON) // Then inform parent
          initializedRef.current = true
        }
      } else if (!initializedRef.current) {
        // Value is falsy (null, undefined, empty string) and we haven't initialized.
        const newItem: LearningItem = {
          id: Date.now().toString(),
          text: '',
          emoji: '📝',
        }
        const defaultPayload = [newItem]
        const defaultJSON = JSON.stringify(defaultPayload)

        setItems(defaultPayload) // Set items first
        onChange(defaultJSON) // Then inform parent
        initializedRef.current = true
      }
    } catch (e) {
      console.error('Error parsing learning items:', e)
      if (!initializedRef.current) {
        console.warn(
          'LearningItemsList: Parsing failed for initial value. Initializing with a default item due to error.'
        )
        const newItem: LearningItem = {
          id: Date.now().toString(),
          text: '',
          emoji: '📝',
        }
        const defaultPayload = [newItem]
        const defaultJSON = JSON.stringify(defaultPayload)

        setItems(defaultPayload) // Set items first
        onChange(defaultJSON) // Then inform parent
        initializedRef.current = true
      }
    }
  }, [value, onChange]) // `items` should NOT be in this dependency array

  // Add a new empty item
  const addItem = () => {
    const newItem: LearningItem = {
      id: Date.now().toString(),
      text: '',
      emoji: '📝',
    }
    const newItems = [...items, newItem]
    setItems(newItems)
    onChange(JSON.stringify(newItems)) // Ensure parent is notified immediately

    setTimeout(() => {
      if (inputRefs.current[newItem.id]) {
        inputRefs.current[newItem.id]?.focus()
        setFocusedItemId(newItem.id)
      }
      if (scrollContainerRef.current && newItems.length > 5) {
        scrollContainerRef.current.scrollTop =
          scrollContainerRef.current.scrollHeight
      }
    }, 0)
  }

  // Update the parent component with the new JSON string when items change
  // This function might be redundant if all updates call setItems and onChange directly
  // const updateItems = (newItems: LearningItem[]) => {
  //   setItems(newItems)
  //   onChange(JSON.stringify(newItems))
  // }

  // Remove an item
  const removeItem = (id: string) => {
    if (focusedItemId === id) {
      setFocusedItemId(null)
    }
    const newItems = items.filter((item) => item.id !== id)
    setItems(newItems)
    onChange(JSON.stringify(newItems))
  }

  // Update item text
  const updateItemText = (id: string, text: string) => {
    const newItems = items.map((item) =>
      item.id === id ? { ...item, text } : item
    )
    setItems(newItems)
    onChange(JSON.stringify(newItems))
  }

  // Update item emoji
  const updateItemEmoji = (id: string, emoji: string) => {
    const newItems = items.map((item) =>
      item.id === id ? { ...item, emoji } : item
    )
    setItems(newItems)
    onChange(JSON.stringify(newItems))
    setShowEmojiPicker(null)

    setTimeout(() => {
      if (inputRefs.current[id]) {
        inputRefs.current[id]?.focus()
        setFocusedItemId(id)
      }
    }, 0)
  }

  // Update item link
  const updateItemLink = (id: string, link: string) => {
    const newItems = items.map((item) =>
      item.id === id ? { ...item, link: link || undefined } : item
    ) // Ensure empty string becomes undefined if desired, or handle as ""
    setItems(newItems)
    onChange(JSON.stringify(newItems))
  }

  // ... (rest of your component: handleEmojiSelect, handleInputFocus, handleInputBlur, refs, JSX)
  // Restore focus after re-render if an item was focused
  useEffect(() => {
    if (focusedItemId) {
      if (showLinkInput === focusedItemId) {
        if (linkInputFieldRefs.current[focusedItemId]) {
          linkInputFieldRefs.current[focusedItemId]?.focus()
        }
      } else if (inputRefs.current[focusedItemId]) {
        inputRefs.current[focusedItemId]?.focus()
      }

      if (items.length > 5 && scrollContainerRef.current) {
        const focusedElement = document.getElementById(
          `learning-item-${focusedItemId}`
        )
        if (focusedElement) {
          const containerRect =
            scrollContainerRef.current.getBoundingClientRect()
          const elementRect = focusedElement.getBoundingClientRect()
          if (
            elementRect.top < containerRect.top ||
            elementRect.bottom > containerRect.bottom
          ) {
            focusedElement.scrollIntoView({
              block: 'nearest',
              behavior: 'smooth',
            })
          }
        }
      }
    }
  }, [items, focusedItemId, showLinkInput]) // focusedItemId and showLinkInput are sufficient if items don't change refs unnecessarily

  // Handle clicks outside of emoji picker and link input
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(null)
      }
      if (
        linkInputRef.current &&
        !linkInputRef.current.contains(event.target as Node) &&
        // Additional check to ensure we are not clicking the link icon again
        !(event.target as HTMLElement).closest(
          `[data-itemid="${showLinkInput}"] [data-role="link-icon"]`
        )
      ) {
        setShowLinkInput(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showLinkInput]) // Added showLinkInput as a dependency for the linkInputRef check logic.

  const handleEmojiSelect = (id: string, emojiData: any) => {
    updateItemEmoji(id, emojiData.emoji)
  }

  const handleInputFocus = (id: string) => {
    setFocusedItemId(id)
  }

  const handleInputBlur = () => {
    setTimeout(() => {
      if (
        !(
          document.activeElement &&
          (document.activeElement.classList.contains('learning-item-input') ||
            document.activeElement.closest('[data-emoji-picker="true"]'))
        ) // Check if focus moved to emoji picker)
      ) {
        // Only clear focusedItemId if focus is truly lost from the component's interactive elements
        setShowLinkInput(null) // Consider if this should also happen on blur.
      }
    }, 100) // Delay allows other focus events to occur
  }

  const setInputRef = (id: string) => (el: HTMLInputElement | null) => {
    inputRefs.current[id] = el
  }

  const setLinkInputRef = (id: string) => (el: HTMLInputElement | null) => {
    linkInputFieldRefs.current[id] = el
  }

  const isScrollable = items.length > 5

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <div className="rounded-lg bg-gray-50/50 py-3 text-center text-sm text-gray-500">
          {t('noItems')}
        </div>
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
                  setShowEmojiPicker(
                    showEmojiPicker === item.id ? null : item.id
                  )
                  setShowLinkInput(null)
                  setFocusedItemId(item.id) // Keep focus context
                }}
                className="shrink-0 text-lg"
              >
                <span>{item.emoji}</span>
              </button>

              <Input
                ref={setInputRef(item.id)}
                value={item.text}
                onChange={(e) => updateItemText(item.id, e.target.value)}
                onFocus={() => handleInputFocus(item.id)}
                onBlur={handleInputBlur}
                placeholder={t('placeholder')}
                className="learning-item-input h-8 grow border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
              />

              {item.link && (
                <div className="flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-500">
                  <LinkIcon size={12} />
                  <span className="max-w-[100px] truncate">{item.link}</span>
                </div>
              )}

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-itemid={item.id} // For click outside check
                  data-role="link-icon" // For click outside check
                  onClick={() => {
                    const newShowLinkInput =
                      showLinkInput === item.id ? null : item.id
                    setShowLinkInput(newShowLinkInput)
                    setShowEmojiPicker(null)
                    setFocusedItemId(item.id)
                    if (newShowLinkInput) {
                      // Only focus if opening
                      setTimeout(() => {
                        linkInputFieldRefs.current[item.id]?.focus()
                      }, 0)
                    }
                  }}
                  className="text-gray-400 transition-colors hover:text-blue-500"
                  title={item.link ? t('editLinkTooltip') : t('addLinkTooltip')}
                >
                  <LinkIcon size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-gray-300 transition-colors hover:text-gray-500"
                  aria-label={t('removeItemAriaLabel')}
                  title={t('removeItemTooltip')}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {showEmojiPicker === item.id && (
              // Added data-emoji-picker attribute for blur check
              <div
                ref={pickerRef}
                className="absolute left-0 z-10 mt-1"
                data-emoji-picker="true"
              >
                <EmojiPicker
                  height="25rem"
                  width="25rem"
                  onEmojiClick={(emoji: any) =>
                    handleEmojiSelect(item.id, emoji)
                  }
                  theme={Theme.LIGHT}
                  previewConfig={{ showPreview: false }}
                  searchPlaceHolder={t('searchEmojis')}
                  autoFocusSearch={true}
                  skinTonesDisabled={true}
                />
              </div>
            )}

            {showLinkInput === item.id && (
              <div
                ref={linkInputRef}
                className="shadow-xs mt-1 rounded-lg border border-gray-200 bg-white p-2"
              >
                <Input
                  ref={setLinkInputRef(item.id)}
                  value={item.link || ''} // Use current item's link directly
                  onChange={(e) => updateItemLink(item.id, e.target.value)}
                  onFocus={() => handleInputFocus(item.id)} // Keep focus context
                  onBlur={handleInputBlur}
                  placeholder={t('linkInputPlaceholder')}
                  className="learning-item-input w-full text-sm"
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
        <Plus size={16} className="text-blue-500" />
        <span>{t('addItemButton')}</span>
      </button>
    </div>
  )
}

export default LearningItemsList
