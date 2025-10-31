import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Edit,
  Maximize2,
  Minimize2,
  Palette,
  RotateCw,
  Square,
} from 'lucide-react';
import { useEditorProvider } from '@components/Contexts/Editor/EditorContext';
import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { twMerge } from 'tailwind-merge';
import type React from 'react';

const FlipcardExtension: React.FC = (props: any) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const t = useTranslations('DashPage.Editor.Flipcard');
  const [question, setQuestion] = useState(props.node.attrs.question);
  const [answer, setAnswer] = useState(props.node.attrs.answer);
  const [color, setColor] = useState(props.node.attrs.color || 'blue');
  const [alignment, setAlignment] = useState(props.node.attrs.alignment || 'center');
  const [size, setSize] = useState(props.node.attrs.size || 'medium');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [isEditingAnswer, setIsEditingAnswer] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const answerInputRef = useRef<HTMLTextAreaElement>(null);
  const editorState = useEditorProvider() as any;
  const isEditable = editorState.isEditable;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleFlip = () => {
    // Allow flipping in both edit and view modes, but prevent when editing text
    if (!(isEditingQuestion || isEditingAnswer)) {
      setIsFlipped(!isFlipped);
    }
  };

  const handleQuestionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(e.target.value);
    props.updateAttributes({
      question: e.target.value,
    });
  };

  const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAnswer(e.target.value);
    props.updateAttributes({
      answer: e.target.value,
    });
  };

  const handleAlignmentChange = (newAlignment: 'left' | 'center' | 'right') => {
    setAlignment(newAlignment);
    props.updateAttributes({
      alignment: newAlignment,
    });
  };

  const handleColorSelect = (selectedColor: string) => {
    setColor(selectedColor);
    setShowColorPicker(false);
    props.updateAttributes({
      color: selectedColor,
    });
  };

  const handleSizeChange = (newSize: 'small' | 'medium' | 'large') => {
    setSize(newSize);
    props.updateAttributes({
      size: newSize,
    });
  };

  const getAlignmentClass = () => {
    switch (alignment) {
      case 'left': {
        return 'text-left justify-start';
      }
      case 'center': {
        return 'text-center justify-center';
      }
      case 'right': {
        return 'text-right justify-end';
      }
      default: {
        return 'text-center justify-center';
      }
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'small': {
        return 'w-64 h-36';
      }
      case 'medium': {
        return 'w-80 h-48';
      }
      case 'large': {
        return 'w-96 h-60';
      }
      default: {
        return 'w-80 h-48';
      }
    }
  };

  const getFontSizeClass = () => {
    switch (size) {
      case 'small': {
        return 'text-sm';
      }
      case 'medium': {
        return 'text-lg';
      }
      case 'large': {
        return 'text-xl';
      }
      default: {
        return 'text-lg';
      }
    }
  };

  const getIconSizeClass = () => {
    switch (size) {
      case 'small': {
        return 16;
      }
      case 'medium': {
        return 20;
      }
      case 'large': {
        return 24;
      }
      default: {
        return 20;
      }
    }
  };

  const getCardColor = (color: string, isBack = false) => {
    const baseColors = {
      sky: isBack ? 'bg-sky-600 border-sky-700' : 'bg-sky-500 border-sky-600',
      green: isBack ? 'bg-green-600 border-green-700' : 'bg-green-500 border-green-600',
      yellow: isBack ? 'bg-yellow-600 border-yellow-700' : 'bg-yellow-500 border-yellow-600',
      red: isBack ? 'bg-red-600 border-red-700' : 'bg-red-500 border-red-600',
      purple: isBack ? 'bg-purple-600 border-purple-700' : 'bg-purple-500 border-purple-600',
      teal: isBack ? 'bg-teal-600 border-teal-700' : 'bg-teal-500 border-teal-600',
      amber: isBack ? 'bg-amber-600 border-amber-700' : 'bg-amber-500 border-amber-600',
      indigo: isBack ? 'bg-indigo-600 border-indigo-700' : 'bg-indigo-500 border-indigo-600',
      neutral: isBack ? 'bg-neutral-700 border-neutral-800' : 'bg-neutral-600 border-neutral-700',
      blue: isBack ? 'bg-blue-600 border-blue-700' : 'bg-blue-500 border-blue-600',
    };
    return baseColors[color as keyof typeof baseColors] || baseColors.blue;
  };

  const colors = ['sky', 'green', 'yellow', 'red', 'purple', 'teal', 'amber', 'indigo', 'neutral', 'blue'];

  const handleQuestionEdit = () => {
    setIsEditingQuestion(true);
    setTimeout(() => questionInputRef.current?.focus(), 0);
  };

  const handleAnswerEdit = () => {
    setIsEditingAnswer(true);
    setTimeout(() => answerInputRef.current?.focus(), 0);
  };

  const handleQuestionBlur = () => {
    setIsEditingQuestion(false);
  };

  const handleAnswerBlur = () => {
    setIsEditingAnswer(false);
  };

  return (
    <NodeViewWrapper className={`flipcard-wrapper flex ${getAlignmentClass()} my-4`}>
      <div className={`flipcard-container ${getSizeClass()} relative`}>
        <div
          className={`flipcard-inner cursor-pointer ${isFlipped ? 'flipped' : ''}`}
          onClick={handleFlip}
        >
          {/* Front Side (Question) */}
          <div
            className={twMerge(
              'flipcard-front nice-shadow flex flex-col items-center justify-center border-2 p-6 text-center text-white',
              getCardColor(color, false),
            )}
          >
            <div className="pointer-events-none mb-3 flex items-center justify-center select-none">
              <RotateCw
                size={getIconSizeClass()}
                className="opacity-70"
              />
            </div>
            <div className="flex flex-1 items-center justify-center">
              {isEditable && isEditingQuestion ? (
                <textarea
                  ref={questionInputRef}
                  value={question}
                  onChange={handleQuestionChange}
                  onBlur={handleQuestionBlur}
                  className="h-20 w-full resize-none rounded-lg border-none bg-white/20 p-2 text-center text-white placeholder-white/70 backdrop-blur-sm outline-none"
                  placeholder={t('enterQuestionPlaceholder')}
                />
              ) : (
                <div
                  className={`text-center font-medium ${getFontSizeClass()} flex items-center justify-center leading-relaxed select-none`}
                >
                  <span className="pointer-events-none select-none">{question}</span>
                  {isEditable && (
                    <button
                      data-flipcard-ui
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuestionEdit();
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="pointer-events-auto ml-2 shrink-0 opacity-60 hover:opacity-100"
                    >
                      <Edit size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
            {!isEditingQuestion && (
              <div className="pointer-events-none mt-3 text-xs opacity-70 select-none">{t('clickToFlip')}</div>
            )}
          </div>

          {/* Back Side (Answer) */}
          <div
            className={twMerge(
              'flipcard-back nice-shadow flex flex-col items-center justify-center border-2 p-6 text-center text-white',
              getCardColor(color, true),
            )}
          >
            <div className="pointer-events-none mb-3 flex items-center justify-center select-none">
              <RotateCw
                size={getIconSizeClass()}
                className="rotate-180 opacity-70"
              />
            </div>
            <div className="flex flex-1 items-center justify-center">
              {isEditable && isEditingAnswer ? (
                <textarea
                  ref={answerInputRef}
                  value={answer}
                  onChange={handleAnswerChange}
                  onBlur={handleAnswerBlur}
                  className="h-20 w-full resize-none rounded-lg border-none bg-white/20 p-2 text-center text-white placeholder-white/70 backdrop-blur-sm outline-none"
                  placeholder={t('enterAnswerPlaceholder')}
                />
              ) : (
                <div
                  className={`text-center font-medium ${getFontSizeClass()} flex items-center justify-center leading-relaxed select-none`}
                >
                  <span className="pointer-events-none select-none">{answer}</span>
                  {isEditable && (
                    <button
                      data-flipcard-ui
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAnswerEdit();
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="pointer-events-auto ml-2 shrink-0 opacity-60 hover:opacity-100"
                    >
                      <Edit size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
            {!isEditingAnswer && <div className="mt-3 text-xs opacity-70">{t('clickToFlipBack')}</div>}
          </div>
        </div>

        {/* Editor Controls */}
        {isEditable && (
          <div
            className="mt-3 flex justify-center space-x-1 opacity-60 transition-opacity hover:opacity-100"
            contentEditable={false}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              data-flipcard-ui
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAlignmentChange('left');
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={`rounded-md p-1.5 text-xs transition-colors ${alignment === 'left' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              title={t('alignLeft')}
            >
              <AlignLeft size={12} />
            </button>
            <button
              data-flipcard-ui
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAlignmentChange('center');
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={`rounded-md p-1.5 text-xs transition-colors ${alignment === 'center' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              title={t('alignCenter')}
            >
              <AlignCenter size={12} />
            </button>
            <button
              data-flipcard-ui
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAlignmentChange('right');
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={`rounded-md p-1.5 text-xs transition-colors ${alignment === 'right' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              title={t('alignRight')}
            >
              <AlignRight size={12} />
            </button>

            {/* Size Controls */}
            <div className="mx-1 h-4 w-px self-center bg-gray-300" />

            <button
              data-flipcard-ui
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSizeChange('small');
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={`rounded-md p-1.5 text-xs transition-colors ${size === 'small' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              title={t('smallSize')}
            >
              <Minimize2 size={12} />
            </button>
            <button
              data-flipcard-ui
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSizeChange('medium');
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={`rounded-md p-1.5 text-xs transition-colors ${size === 'medium' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              title={t('mediumSize')}
            >
              <Square size={12} />
            </button>
            <button
              data-flipcard-ui
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSizeChange('large');
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={`rounded-md p-1.5 text-xs transition-colors ${size === 'large' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              title={t('largeSize')}
            >
              <Maximize2 size={12} />
            </button>

            <div className="mx-1 h-4 w-px self-center bg-gray-300" />

            <button
              data-flipcard-ui
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowColorPicker(!showColorPicker);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="rounded-md bg-gray-100 p-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-200"
              title={t('changeColor')}
            >
              <Palette size={12} />
            </button>
            <button
              data-flipcard-ui
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFlipped(!isFlipped);
              }}
              onMouseDown={(e) => e.preventDefault()}
              className="rounded-md bg-gray-100 p-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-200"
              title={t('previewFlip')}
            >
              <RotateCw size={12} />
            </button>
          </div>
        )}

        {/* Color Picker */}
        {isEditable && showColorPicker && (
          <div
            data-flipcard-ui
            ref={colorPickerRef}
            className="nice-shadow absolute top-full left-1/2 z-10 mt-2 -translate-x-1/2 transform rounded-lg bg-white p-3"
            contentEditable={false}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex max-w-xs flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  data-flipcard-ui
                  type="button"
                  key={c}
                  className={`h-8 w-8 transform rounded-full border-2 border-white transition-transform hover:scale-110 ${getCardColor(c)} ${color === c ? 'ring-2 ring-gray-400 ring-offset-2' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleColorSelect(c);
                  }}
                  title={t(`colors.${c}` as any)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export default FlipcardExtension;
