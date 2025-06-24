import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { ChevronDown, ChevronRight, Palette } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import { twMerge } from 'tailwind-merge';

import { useEditorProvider } from '@components/Contexts/Editor/EditorContext';

const BadgesExtension: FC = (props: any) => {
  const t = useTranslations('DashPage.Editor.BadgesExtension');
  const [color, setColor] = useState(props.node.attrs.color);
  const [emoji, setEmoji] = useState(props.node.attrs.emoji);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showPredefinedCallouts, setShowPredefinedCallouts] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const editorState = useEditorProvider() as any;
  const { isEditable } = editorState;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        (pickerRef.current && !pickerRef.current.contains(event.target as Node)) ||
        (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node))
      ) {
        setShowEmojiPicker(false);
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleEmojiSelect = (emoji: any) => {
    setEmoji(emoji.emoji);
    setShowEmojiPicker(false);
    props.updateAttributes({
      emoji: emoji.emoji,
    });
  };

  const handleColorSelect = (selectedColor: string) => {
    setColor(selectedColor);
    setShowColorPicker(false);
    props.updateAttributes({
      color: selectedColor,
    });
  };

  const handlePredefinedBadgeSelect = (badge: (typeof predefinedBadges)[0]) => {
    setEmoji(badge.emoji);
    setColor(badge.color);

    props.updateAttributes({
      emoji: badge.emoji,
      color: badge.color,
    });

    // Insert the predefined content
    const { editor } = props;
    if (editor) {
      editor.commands.setTextSelection({
        from: props.getPos() + 1,
        to: props.getPos() + props.node.nodeSize - 1,
      });
      editor.commands.insertContent(badge.content);
    }

    setShowPredefinedCallouts(false);
  };

  const colors = ['sky', 'green', 'yellow', 'red', 'purple', 'teal', 'amber', 'indigo', 'neutral'];
  const predefinedBadges = [
    {
      emoji: '📝',
      color: 'sky',
      content: t('keyConcept'),
    },
    {
      emoji: '💡',
      color: 'yellow',
      content: t('example'),
    },
    {
      emoji: '🔍',
      color: 'teal',
      content: t('deepDive'),
    },
    {
      emoji: '⚠️',
      color: 'red',
      content: t('importantNote'),
    },
    {
      emoji: '🧠',
      color: 'purple',
      content: t('rememberThis'),
    },
    {
      emoji: '🏋️',
      color: 'green',
      content: t('exercise'),
    },
    {
      emoji: '🎯',
      color: 'amber',
      content: t('learningObjective'),
    },
    {
      emoji: '📚',
      color: 'indigo',
      content: t('furtherReading'),
    },
    {
      emoji: '💬',
      color: 'neutral',
      content: t('discussionTopic'),
    },
  ];

  const getBadgeColor = (color: string) => {
    switch (color) {
      case 'sky':
        return 'bg-sky-400 text-sky-50';
      case 'green':
        return 'bg-green-400 text-green-50';
      case 'yellow':
        return 'bg-yellow-400 text-black';
      case 'red':
        return 'bg-red-500 text-red-50';
      case 'purple':
        return 'bg-purple-400 text-purple-50';
      case 'pink':
        return 'bg-pink-400 text-pink-50';
      case 'teal':
        return 'bg-teal-400 text-teal-900';
      case 'amber':
        return 'bg-amber-600 text-amber-100';
      case 'indigo':
        return 'bg-indigo-400 text-indigo-50';
      case 'neutral':
        return 'bg-neutral-800 text-white';
      default:
        return 'bg-sky-400 text-white';
    }
  };

  return (
    <NodeViewWrapper>
      <div className="relative flex items-center space-x-2">
        <div
          className={twMerge(
            'nice-shadow my-2 flex w-fit items-center space-x-1 rounded-full px-3.5 py-1.5 text-sm font-semibold outline-2 outline-white/20',
            getBadgeColor(color),
          )}
        >
          <div className="flex items-center justify-center space-x-1">
            <span className="text">{emoji}</span>
            {isEditable && (
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                <ChevronDown size={14} />
              </button>
            )}
          </div>
          <NodeViewContent className="content text capitalize tracking-wide" />
          {isEditable && (
            <div className="relative flex items-center justify-center space-x-2">
              <button onClick={() => setShowColorPicker(!showColorPicker)}>
                <Palette size={14} />
              </button>
              {showColorPicker && (
                <div
                  ref={colorPickerRef}
                  className="nice-shadow absolute left-full ml-2 rounded-full bg-white p-2"
                >
                  <div className="flex space-x-2">
                    {colors.map((c) => (
                      <button
                        key={c}
                        className={`h-8 w-8 rounded-full ${getBadgeColor(c)} focus:outline-hidden hover:ring-2 hover:ring-opacity-50 focus:ring-2 focus:ring-opacity-50`}
                        onClick={() => handleColorSelect(c)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {isEditable && (
          <button
            onClick={() => setShowPredefinedCallouts(!showPredefinedCallouts)}
            className="text-neutral-300 transition-colors hover:text-neutral-400"
          >
            <ChevronRight size={16} />
          </button>
        )}

        {isEditable && showPredefinedCallouts && (
          <div className="nice-shadow absolute left-0 top-full z-10 mt-2 flex flex-wrap gap-2 rounded-lg bg-white/90 p-2 backdrop-blur-md">
            {predefinedBadges.map((badge, index) => (
              <button
                key={index}
                onClick={() => handlePredefinedBadgeSelect(badge)}
                className={`flex items-center space-x-2 rounded-xl px-3 py-1 text-xs ${getBadgeColor(badge.color)} light-shadow font-bold text-gray-600 transition-all duration-100 ease-linear hover:opacity-80`}
              >
                <span className="text-xs">{badge.emoji}</span>
                <span className="content capitalize">{badge.content}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {isEditable && showEmojiPicker && (
        <div ref={pickerRef}>
          <EmojiPicker
            onEmojiClick={handleEmojiSelect}
            height="30rem"
            width="25rem"
            theme={Theme.LIGHT}
            previewConfig={{ showPreview: false }}
            searchPlaceHolder={t('searchEmojis')}
            autoFocusSearch
            skinTonesDisabled
          />
        </div>
      )}
    </NodeViewWrapper>
  );
};

export default BadgesExtension;
