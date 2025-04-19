'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, X, Link as LinkIcon } from 'lucide-react'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'
import { Input } from '@components/ui/input'
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

  // Add a new empty item
  const addItem = () => {
    const newItem: LearningItem = {
      id: Date.now().toString(),
      text: '',
      emoji: '📝',
    }
    const newItems = [...items, newItem]
    setItems(newItems)
    onChange(JSON.stringify(newItems))

    // Focus the newly added item after render
    setTimeout(() => {
      if (inputRefs.current[newItem.id]) {
        inputRefs.current[newItem.id]?.focus()
        setFocusedItemId(newItem.id)
      }

      // Scroll to the bottom when a new item is added
      if (scrollContainerRef.current && newItems.length > 5) {
        scrollContainerRef.current.scrollTop =
          scrollContainerRef.current.scrollHeight
      }
    }, 0)
  }

  // Parse the JSON string to items array when the component mounts or value changes
  useEffect(() => {
    try {
      if (value) {
        const parsedItems = JSON.parse(value)
        if (Array.isArray(parsedItems)) {
          // Ensure parsed items have all necessary fields, adding defaults if missing
          const standardizedItems = parsedItems.map((item) => ({
            id: item.id || Date.now().toString(), // Ensure ID exists
            text: item.text || '',
            emoji: item.emoji || '📝',
            link: item.link || undefined,
          }))
          setItems(standardizedItems)
          initializedRef.current = true
        } else if (!initializedRef.current) {
          // If it's not a valid array format from the start, initialize with one empty item
          const newItem: LearningItem = {
            id: Date.now().toString(),
            text: '',
            emoji: '📝',
          }
          setItems([newItem])
          // Don't call onChange immediately if the initial value is just an empty string or invalid,
          // wait for the user to interact or save. This prevents unnecessary form dirty state.
          // Only call onChange if the *input* value was something parsable but not an array,
          // or if it was completely empty and we need to set the initial structure.
          // Given the parent's useEffect logic, it handles setting the initial formik value.
          // We just need to ensure our internal state `items` is correct.
          // Let's refine this initialization slightly:
          if (typeof value === 'string' && value.trim() !== '') {
            // If there's a non-empty string value that couldn't be parsed as an array,
            // assume it's legacy format and convert to one item.
            setItems([
              {
                id: Date.now().toString(),
                text: value,
                emoji: '📝',
              },
            ])
            // We should also update the parent's formik state to the new JSON format
            // This might cause a re-render loop if not careful.
            // A better approach might be to handle this conversion during formik initialization in the parent.
            // Reverting to simpler logic based on parent's current `initializeLearnings`.
            console.warn(
              'LearningItemsList: Initial value is not a valid JSON array. Initializing with a default item.'
            )
            setItems([newItem])
            onChange(JSON.stringify([newItem])) // Still need to update parent to the expected format
          } else {
            // If value is empty or not a string, initialize with one empty item
            setItems([newItem])
            // Only update parent if the initial value was truly empty, to set the expected [] structure
            if (!value || value.trim() === '') {
              onChange(JSON.stringify([newItem]))
            }
          }
          initializedRef.current = true
        }
      } else if (!initializedRef.current) {
        // Initialize with one empty item if no value and not already initialized
        const newItem: LearningItem = {
          id: Date.now().toString(),
          text: '',
          emoji: '📝',
        }
        setItems([newItem])
        onChange(JSON.stringify([newItem]))
        initializedRef.current = true
      }
    } catch (e) {
      console.error('Error parsing learning items:', e)
      // Initialize with one empty item on error if not already initialized or if parsing failed for non-empty string
      if (
        !initializedRef.current ||
        (typeof value === 'string' && value.trim() !== '')
      ) {
        console.warn(
          'LearningItemsList: Parsing failed for initial value. Initializing with a default item.'
        )
        const newItem: LearningItem = {
          id: Date.now().toString(),
          text: '',
          emoji: '📝',
        }
        setItems([newItem])
        // Update parent state to clear potentially bad JSON
        onChange(JSON.stringify([newItem]))
        initializedRef.current = true
      }
    }
  }, [value, onChange])

  // Restore focus after re-render if an item was focused
  useEffect(() => {
    if (focusedItemId) {
      if (showLinkInput === focusedItemId) {
        // Focus the link input if it's open for the focused item
        if (linkInputFieldRefs.current[focusedItemId]) {
          linkInputFieldRefs.current[focusedItemId]?.focus()
        }
      } else {
        // Focus the text input
        if (inputRefs.current[focusedItemId]) {
          inputRefs.current[focusedItemId]?.focus()
        }
      }

      // Scroll the focused item into view if needed
      if (items.length > 5 && scrollContainerRef.current) {
        const focusedElement = document.getElementById(
          `learning-item-${focusedItemId}`
        )
        if (focusedElement) {
          const containerRect =
            scrollContainerRef.current.getBoundingClientRect()
          const elementRect = focusedElement.getBoundingClientRect()

          // Check if the element is outside the visible area
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
  }, [items, focusedItemId, showLinkInput])

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
        !linkInputRef.current.contains(event.target as Node)
      ) {
        setShowLinkInput(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Update the parent component with the new JSON string when items change
  const updateItems = (newItems: LearningItem[]) => {
    setItems(newItems)
    onChange(JSON.stringify(newItems))
  }

  // Remove an item
  const removeItem = (id: string) => {
    if (focusedItemId === id) {
      setFocusedItemId(null)
    }
    updateItems(items.filter((item) => item.id !== id))
  }

  // Update item text
  const updateItemText = (id: string, text: string) => {
    updateItems(
      items.map((item) => (item.id === id ? { ...item, text } : item))
    )
  }

  // Update item emoji
  const updateItemEmoji = (id: string, emoji: string) => {
    updateItems(
      items.map((item) => (item.id === id ? { ...item, emoji } : item))
    )
    setShowEmojiPicker(null)

    // Restore focus to the text input after emoji selection
    setTimeout(() => {
      if (inputRefs.current[id]) {
        inputRefs.current[id]?.focus()
        setFocusedItemId(id)
      }
    }, 0)
  }

  // Update item link
  const updateItemLink = (id: string, link: string) => {
    updateItems(
      items.map((item) => (item.id === id ? { ...item, link } : item))
    )
  }

  // Handle emoji selection
  const handleEmojiSelect = (id: string, emojiData: any) => {
    updateItemEmoji(id, emojiData.native)
  }

  // Handle focus on input
  const handleInputFocus = (id: string) => {
    setFocusedItemId(id)
  }

  // Handle blur on input
  const handleInputBlur = () => {
    // Don't clear focusedItemId immediately as it might be needed for refocusing
    // We'll use a small delay to allow other focus events to occur first
    setTimeout(() => {
      // Only clear if we're not focusing another input in this component
      if (
        !document.activeElement ||
        !document.activeElement.classList.contains('learning-item-input')
      ) {
        setFocusedItemId(null)
      }
    }, 100)
  }

  // Ref callback for text inputs
  const setInputRef = (id: string) => (el: HTMLInputElement | null) => {
    inputRefs.current[id] = el
  }

  // Ref callback for link inputs
  const setLinkInputRef = (id: string) => (el: HTMLInputElement | null) => {
    linkInputFieldRefs.current[id] = el
  }

  // Determine if we need to make the list scrollable
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
                  onClick={() => {
                    setShowLinkInput(showLinkInput === item.id ? null : item.id)
                    setShowEmojiPicker(null)
                    setFocusedItemId(item.id)
                    // Focus the link input after render
                    setTimeout(() => {
                      if (linkInputFieldRefs.current[item.id]) {
                        linkInputFieldRefs.current[item.id]?.focus()
                      }
                    }, 0)
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
              <div ref={pickerRef} className="absolute left-0 z-10 mt-1">
                <Picker
                  data={data}
                  onEmojiSelect={(emoji: any) =>
                    handleEmojiSelect(item.id, emoji)
                  }
                  theme="light"
                  previewPosition="none"
                  searchPosition="top"
                  maxFrequentRows={0}
                  autoFocus={false}
                />
              </div>
            )}

            {showLinkInput === item.id && (
              <div
                ref={linkInputRef}
                className="mt-1 rounded-lg border border-gray-200 bg-white p-2 shadow-xs"
              >
                <Input
                  ref={setLinkInputRef(item.id)}
                  value={items.find((i) => i.id === item.id)?.link || ''}
                  onChange={(e) => updateItemLink(item.id, e.target.value)}
                  onFocus={() => handleInputFocus(item.id)}
                  onBlur={handleInputBlur}
                  placeholder={t('linkInputPlaceholder')}
                  className="learning-item-input w-full text-sm"
                  autoFocus
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
