'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Select, SelectContent, SelectItem, SelectPositioner, SelectTrigger, SelectValue } from '@components/ui/select';
import { getAPIUrl } from '@/services/config/config';
import { Textarea } from '@components/ui/textarea';
import { Checkbox } from '@components/ui/checkbox';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Input } from '@components/ui/input';

interface Question {
  id?: number;
  question_uuid?: string;
  question_text: string;
  question_type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MATCHING';
  points: number;
  explanation?: string;
  answer_options: { text?: string; is_correct?: boolean; left?: string; right?: string }[];
  order_index: number;
}

interface QuestionEditorProps {
  question: Question | null;
  examUuid: string;
  accessToken: string;
  onSave: () => void;
  onCancel: () => void;
  autoFocus?: boolean;
}

export default function QuestionEditor({
  question,
  examUuid,
  accessToken,
  onSave,
  onCancel,
  autoFocus,
}: QuestionEditorProps) {
  const t = useTranslations('Components.QuestionManagement');
  const [formData, setFormData] = useState<Question>(
    question || {
      question_text: '',
      question_type: 'SINGLE_CHOICE',
      points: 1,
      explanation: '',
      answer_options: [{ text: '', is_correct: false }],
      order_index: 0,
    },
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (autoFocus) {
      const el = document.getElementById('question-text') as HTMLTextAreaElement | null;
      if (el) el.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    // If parent supplies a different question (e.g., opening for edit/new), update form
    setFormData(
      question || {
        question_text: '',
        question_type: 'SINGLE_CHOICE',
        points: 1,
        explanation: '',
        answer_options: [{ text: '', is_correct: false }],
        order_index: 0,
      },
    );
  }, [question]);

  const handleSave = async () => {
    if (!formData.question_text.trim()) {
      toast.error(t('questionTextRequired'));
      return;
    }

    if (formData.answer_options.length === 0) {
      toast.error(t('atLeastOneOption'));
      return;
    }

    setIsSaving(true);

    try {
      const isEditing = Boolean(formData.question_uuid);
      const url = isEditing
        ? `${getAPIUrl()}exams/questions/${formData.question_uuid}`
        : `${getAPIUrl()}exams/${examUuid}/questions`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          question_text: formData.question_text,
          question_type: formData.question_type,
          points: formData.points,
          explanation: formData.explanation,
          answer_options: formData.answer_options,
          order_index: formData.order_index,
        }),
      });

      if (!response.ok) throw new Error('Failed to save question');

      toast.success(isEditing ? t('questionUpdated') : t('questionCreated'));
      onSave();
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error(t('errorSavingQuestion'));
    } finally {
      setIsSaving(false);
    }
  };

  const addOption = () => {
    setFormData({
      ...formData,
      answer_options: [
        ...formData.answer_options,
        formData.question_type === 'MATCHING' ? { left: '', right: '' } : { text: '', is_correct: false },
      ],
    });
  };

  const removeOption = (index: number) => {
    setFormData({
      ...formData,
      answer_options: formData.answer_options.filter((_, i) => i !== index),
    });
  };

  const updateOption = (
    index: number,
    updates: Partial<{ text?: string; is_correct?: boolean; left?: string; right?: string }>,
  ) => {
    const newOptions = [...formData.answer_options];
    newOptions[index] = { ...newOptions[index], ...updates };
    setFormData({ ...formData, answer_options: newOptions });
  };

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-medium">{formData.question_uuid ? t('editQuestion') : t('addNewQuestion')}</h3>
        <p className="text-sm text-gray-500">{t('fillInQuestionDetails')}</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="question-text">{t('questionText')}</Label>
          <Textarea
            id="question-text"
            value={formData.question_text}
            onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
            placeholder={t('questionTextPlaceholder')}
            rows={3}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="question-type">{t('questionType')}</Label>
            <Select
              value={formData.question_type}
              onValueChange={(value: any) => setFormData({ ...formData, question_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectPositioner>
                <SelectContent>
                  {[
                    { value: 'SINGLE_CHOICE', label: t('single_choice') },
                    { value: 'MULTIPLE_CHOICE', label: t('multiple_choice') },
                    { value: 'TRUE_FALSE', label: t('true_false') },
                    { value: 'MATCHING', label: t('matching') },
                  ].map((item) => (
                    <SelectItem
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectPositioner>
            </Select>
          </div>

          <div>
            <Label htmlFor="points">{t('pointsLabel')}</Label>
            <Input
              id="points"
              type="number"
              min="1"
              value={formData.points}
              onChange={(e) => setFormData({ ...formData, points: Number.parseInt(e.target.value) })}
            />
          </div>
        </div>

        <div>
          <Label>{t('answerOptions')}</Label>
          <div className="mt-2 space-y-2">
            {formData.answer_options.map((option, index) => (
              <div
                key={index}
                className="flex items-center gap-2"
              >
                {formData.question_type === 'MATCHING' ? (
                  <>
                    <Input
                      placeholder={t('leftSide')}
                      value={option.left || ''}
                      onChange={(e) => updateOption(index, { left: e.target.value })}
                      className="flex-1"
                    />
                    <span className="pt-2">→</span>
                    <Input
                      placeholder={t('rightSide')}
                      value={option.right || ''}
                      onChange={(e) => updateOption(index, { right: e.target.value })}
                      className="flex-1"
                    />
                  </>
                ) : (
                  <>
                    <Checkbox
                      checked={option.is_correct}
                      onCheckedChange={(checked) => updateOption(index, { is_correct: checked })}
                    />
                    <Input
                      placeholder={t('optionText', { number: index + 1 })}
                      value={option.text}
                      onChange={(e) => updateOption(index, { text: e.target.value })}
                      className="flex-1"
                    />
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOption(index)}
                  disabled={formData.answer_options.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addOption}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('addOption')}
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="explanation">
            {t('explanation')} {t('optional')}
          </Label>
          <Textarea
            id="explanation"
            value={formData.explanation || ''}
            onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
            placeholder={t('explanationPlaceholder')}
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? t('saving') : t('save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
