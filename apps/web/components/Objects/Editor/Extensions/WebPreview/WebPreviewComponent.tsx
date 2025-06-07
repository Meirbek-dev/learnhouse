import type React from 'react'
import { useState, useEffect, useRef } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import {
  Globe,
  Edit2,
  Save,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash,
} from 'lucide-react'
import { useEditorProvider } from '@components/Contexts/Editor/EditorContext'
import { getUrlPreview } from '@services/courses/activities'
import { useTranslations } from 'next-intl'

interface EditorContext {
  isEditable: boolean
  [key: string]: any
}

interface WebPreviewProps {
  node: any
  updateAttributes: (attrs: any) => void
  extension: any
  deleteNode?: () => void
}

const ALIGNMENTS = [
  { value: 'left', label: <AlignLeft size={16} /> },
  { value: 'center', label: <AlignCenter size={16} /> },
  { value: 'right', label: <AlignRight size={16} /> },
]

const WebPreviewComponent: React.FC<WebPreviewProps> = ({
  node,
  updateAttributes,
  deleteNode,
}) => {
  const t = useTranslations('Components.WebPreview')
  const [inputUrl, setInputUrl] = useState(node.attrs.url || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(!node.attrs.url)
  const inputRef = useRef<HTMLInputElement>(null)
  const editorContext = useEditorProvider() as EditorContext
  const isEditable = editorContext?.isEditable ?? true

  const previewData = {
    title: node.attrs.title,
    description: node.attrs.description,
    og_image: node.attrs.og_image,
    favicon: node.attrs.favicon,
    og_type: node.attrs.og_type,
    og_url: node.attrs.og_url,
    url: node.attrs.url,
  }

  const alignment = node.attrs.alignment || 'left'
  const hasPreview = !!previewData.title

  const [buttonLabel, setButtonLabel] = useState(
    node.attrs.buttonLabel || t('visitSite')
  )
  const [showButton, setShowButton] = useState(node.attrs.showButton !== false)

  const fetchPreview = async (url: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getUrlPreview(url)
      if (!res) throw new Error(t('errorFetchingPreview'))
      const data = res
      updateAttributes({ ...data, url })
      setEditing(false)
    } catch (err: any) {
      setError(err.message || t('errorFetchingPreview'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (node.attrs.url && !hasPreview) {
      fetchPreview(node.attrs.url)
    }
  }, [])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editing])

  useEffect(() => {
    setButtonLabel(node.attrs.buttonLabel || t('visitSite'))
    setShowButton(!!node.attrs.showButton)
  }, [node.attrs.buttonLabel, node.attrs.showButton])

  const handleAlignmentChange = (value: string) => {
    updateAttributes({ alignment: value })
  }

  const handleEdit = () => {
    setEditing(true)
    setInputUrl(node.attrs.url || '')
  }

  const handleSaveEdit = () => {
    if (inputUrl && inputUrl !== node.attrs.url) {
      fetchPreview(inputUrl)
    } else {
      setEditing(false)
    }
    updateAttributes({ buttonLabel, showButton })
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setInputUrl(node.attrs.url || '')
    setError(null)
  }

  const handleDelete = () => {
    if (typeof deleteNode === 'function') {
      deleteNode()
    } else {
      updateAttributes({
        url: null,
        title: null,
        description: null,
        og_image: null,
        favicon: null,
        og_type: null,
        og_url: null,
      })
    }
  }

  // Compute alignment class for CardWrapper
  let alignClass = 'justify-start'
  if (alignment === 'center') alignClass = 'justify-center'
  else if (alignment === 'right') alignClass = 'justify-end'

  return (
    <NodeViewWrapper className="web-preview-block relative">
      <div className={`flex w-full ${alignClass}`}>
        {/* CardWrapper */}
        <div className="nice-shadow relative my-2 min-w-[260px] max-w-[420px] rounded-xl bg-white px-6 pb-4 pt-6">
          {/* PreviewCard */}
          {/* Floating edit and delete buttons (only if not editing and isEditable) */}
          {isEditable && !editing && (
            <div className="absolute -right-3 -top-3 z-20 flex flex-col gap-2">
              <button
                className="flex items-center justify-center rounded-md border border-yellow-200 bg-yellow-50 p-1.5 text-yellow-700 shadow-md hover:bg-yellow-100"
                onClick={handleEdit}
                title={t('editUrl')}
                type="button"
              >
                <Edit2 size={16} />
              </button>
              <button
                className="flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-1.5 text-red-700 shadow-md hover:bg-red-100"
                onClick={handleDelete}
                title={t('deleteCard')}
                type="button"
              >
                <Trash size={16} />
              </button>
            </div>
          )}
          {/* Only show edit bar when editing */}
          {isEditable && editing && (
            <>
              <div className="mb-2 flex items-center gap-2">
                {/* EditBar */}
                <Globe size={18} style={{ opacity: 0.7, marginRight: 4 }} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={t('enterWebsiteUrl')}
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit()
                  }}
                  className="flex-1 rounded-md border border-gray-200 px-2.5 py-1.5 font-sans text-sm focus:border-gray-400 focus:outline-none"
                />
                <button
                  onClick={handleSaveEdit}
                  disabled={loading || !inputUrl}
                  title={t('save')}
                  type="button"
                  className="flex cursor-pointer items-center justify-center rounded-md border-none bg-gray-100 p-1 text-gray-700 transition-colors duration-150 hover:bg-gray-200 disabled:opacity-50 aria-pressed:bg-blue-600 aria-pressed:text-white"
                  aria-pressed={false}
                >
                  <Save size={16} />
                </button>
                <button
                  onClick={handleCancelEdit}
                  title={t('cancel')}
                  type="button"
                  className="flex cursor-pointer items-center justify-center rounded-md border-none bg-gray-100 p-1 text-gray-700 transition-colors duration-150 hover:bg-gray-200"
                >
                  <X size={16} />
                </button>
              </div>
              {/* Button toggle and label input */}
              <div className="mb-2 flex items-center gap-2">
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={showButton}
                    onChange={(e) => {
                      setShowButton(e.target.checked)
                      updateAttributes({ showButton: e.target.checked })
                    }}
                    className="accent-blue-600"
                  />
                  {t('showButton')}
                </label>
                {showButton && (
                  <input
                    type="text"
                    value={buttonLabel}
                    onChange={(e) => {
                      setButtonLabel(e.target.value)
                      updateAttributes({ buttonLabel: e.target.value })
                    }}
                    placeholder={t('buttonLabel')}
                    className="rounded-md border border-gray-200 px-2 py-1 font-sans text-sm focus:border-gray-400 focus:outline-none"
                    style={{ minWidth: 100 }}
                  />
                )}
              </div>
            </>
          )}
          {error && (
            <div className="mt-2 text-xs text-red-600">
              {t('errorFetchingPreview', { error })}
            </div>
          )}
          {/* Only show preview card when not editing */}
          {hasPreview && !editing && (
            <>
              <a
                href={previewData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="no-underline hover:no-underline focus:no-underline active:no-underline"
                style={{ textDecoration: 'none', borderBottom: 'none' }}
              >
                {previewData.og_image && (
                  <div className="-mx-6 -mt-6 mb-0 overflow-hidden rounded-t-xl">
                    <img
                      src={previewData.og_image}
                      alt={t('previewImageAlt')}
                      className="block h-40 w-full object-cover"
                    />
                  </div>
                )}
                <div className="pb-2 pt-4">
                  <span
                    className="mb-1.5 text-lg font-semibold leading-tight text-[#232323] no-underline hover:no-underline focus:no-underline active:no-underline"
                    style={{ textDecoration: 'none', borderBottom: 'none' }}
                  >
                    {previewData.title}
                  </span>
                  <span
                    className="mb-3 block text-sm leading-snug text-gray-700 no-underline hover:no-underline focus:no-underline active:no-underline"
                    style={{ textDecoration: 'none', borderBottom: 'none' }}
                  >
                    {previewData.description}
                  </span>
                </div>
              </a>
              <div className="mt-0 flex items-center border-t border-gray-100 pt-2">
                {previewData.favicon && (
                  <img
                    src={previewData.favicon}
                    alt={t('faviconAlt')}
                    className="mr-2 h-[18px] w-[18px] rounded bg-gray-100"
                  />
                )}
                <span className="truncate text-xs text-gray-500">
                  {previewData.url}
                </span>
              </div>
              {showButton && previewData.url && (
                <a
                  href={previewData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nice-shadow mt-4 block w-full rounded-xl bg-white px-4 py-2.5 text-center text-[16px] font-semibold text-purple-600 no-underline transition-all hover:bg-gray-50 hover:shadow-lg [&:hover]:text-black [&:not(:hover)]:text-black"
                  style={{ textDecoration: 'none', color: 'black' }}
                >
                  {buttonLabel || t('visitSite')}
                </a>
              )}
            </>
          )}
          {isEditable && !editing && (
            <div className="mt-2 flex items-center gap-1">
              {/* AlignmentBar */}
              <span className="mr-1 text-xs text-gray-500">{t('align')}:</span>
              {ALIGNMENTS.map((opt) => (
                <button
                  key={opt.value}
                  aria-pressed={alignment === opt.value}
                  onClick={() => handleAlignmentChange(opt.value)}
                  title={t('alignOption', { value: t(opt.value) })}
                  type="button"
                  className={`flex items-center justify-center rounded-full border p-1.5 text-gray-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                    alignment === opt.value
                      ? 'border-gray-600 bg-gray-600 text-white hover:bg-gray-700'
                      : 'border-gray-200 bg-white hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export default WebPreviewComponent
