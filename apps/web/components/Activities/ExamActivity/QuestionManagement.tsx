'use client';

import { Download, Edit2, GripVertical, Plus, Trash2, Upload } from 'lucide-react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
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

interface QuestionManagementProps {
  examUuid: string;
  questions: Question[];
  accessToken: string;
  onQuestionsChange: () => void;
}

export default function QuestionManagement({
  examUuid,
  questions,
  accessToken,
  onQuestionsChange,
}: QuestionManagementProps) {
  const t = useTranslations('Components.QuestionManagement');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddQuestion = () => {
    setEditingQuestion({
      question_text: '',
      question_type: 'SINGLE_CHOICE',
      points: 1,
      explanation: '',
      answer_options: [{ text: '', is_correct: false }],
      order_index: questions.length,
    });
    setIsDialogOpen(true);
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch(`${getAPIUrl()}exams/${examUuid}/questions/export-csv`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) throw new Error('Failed to export questions');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exam_${examUuid}_questions.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(t('questionsExported'));
    } catch (error) {
      console.error('Error exporting questions:', error);
      toast.error(t('errorExportingQuestions'));
    }
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${getAPIUrl()}exams/${examUuid}/questions/import-csv`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to import questions');

      const result = await response.json();

      if (result.errors && result.errors.length > 0) {
        toast.warning(
          t('questionsImportedWithErrors', {
            imported: result.imported,
            errors: result.errors.length,
          }),
        );
        console.error('Import errors:', result.errors);
      } else {
        toast.success(t('questionsImported', { count: result.imported }));
      }

      onQuestionsChange();
    } catch (error) {
      console.error('Error importing questions:', error);
      toast.error(t('errorImportingQuestions'));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setIsDialogOpen(true);
  };

  const handleDeleteQuestion = async (questionUuid: string) => {
    if (!confirm(t('confirmDelete'))) return;

    try {
      const response = await fetch(`${getAPIUrl()}exams/questions/${questionUuid}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete question');

      toast.success(t('questionDeleted'));
      onQuestionsChange();
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error(t('errorDeletingQuestion'));
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = [...questions];
    const [reorderedItem] = items.splice(result.source.index, 1);
    if (!reorderedItem) return;
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order_index for all questions
    try {
      await Promise.all(
        items.map((question, index) =>
          fetch(`${getAPIUrl()}exams/questions/${question.question_uuid}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ order_index: index }),
          }),
        ),
      );

      toast.success(t('questionsReordered'));
      onQuestionsChange();
    } catch (error) {
      console.error('Error reordering questions:', error);
      toast.error(t('errorReorderingQuestions'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('questionBank')}</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
          >
            <Download className="mr-2 h-4 w-4" />
            {t('exportCSV')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {t('importCSV')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
          <Dialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
          >
            <DialogTrigger
              render={
                <Button onClick={handleAddQuestion}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('addQuestion')}
                </Button>
              }
            />
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
              <QuestionEditor
                question={editingQuestion}
                examUuid={examUuid}
                accessToken={accessToken}
                onSave={() => {
                  setIsDialogOpen(false);
                  setEditingQuestion(null);
                  onQuestionsChange();
                }}
                onCancel={() => {
                  setIsDialogOpen(false);
                  setEditingQuestion(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {questions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">{t('noQuestions')}</CardContent>
        </Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="questions">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-2"
              >
                {questions.map((question, index) => (
                  <Draggable
                    key={question.question_uuid || index}
                    draggableId={question.question_uuid || `temp-${index}`}
                    index={index}
                  >
                    {(provided) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="transition-shadow hover:shadow-md"
                      >
                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                          <div className="flex flex-1 items-start gap-3">
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-move pt-1"
                            >
                              <GripVertical className="h-5 w-5 text-gray-400" />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-base">{t('questionNumber', { number: index + 1 })}</CardTitle>
                              <p className="mt-2 text-sm text-gray-700">{question.question_text}</p>
                              <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                                <span>{t(question.question_type.toLowerCase())}</span>
                                <span>•</span>
                                <span>{t('pointsValue', { points: question.points })}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditQuestion(question)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteQuestion(question.question_uuid!)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </CardHeader>
                      </Card>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}

interface QuestionEditorProps {
  question: Question | null;
  examUuid: string;
  accessToken: string;
  onSave: () => void;
  onCancel: () => void;
}

function QuestionEditor({ question, examUuid, accessToken, onSave, onCancel }: QuestionEditorProps) {
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
    <>
      <DialogHeader>
        <DialogTitle>{formData.question_uuid ? t('editQuestion') : t('addNewQuestion')}</DialogTitle>
        <DialogDescription>{t('fillInQuestionDetails')}</DialogDescription>
      </DialogHeader>

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
              <SelectContent>
                <SelectItem value="SINGLE_CHOICE">{t('single_choice')}</SelectItem>
                <SelectItem value="MULTIPLE_CHOICE">{t('multiple_choice')}</SelectItem>
                <SelectItem value="TRUE_FALSE">{t('true_false')}</SelectItem>
                <SelectItem value="MATCHING">{t('matching')}</SelectItem>
              </SelectContent>
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
                className="flex items-start gap-2"
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
    </>
  );
}
