'use client';

import { Check, Info, Loader2, Minus, Plus, PlusCircle, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn, generateUUID } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import {
  getAssignmentTask,
  getAssignmentTaskSubmissionsMe,
  getAssignmentTaskSubmissionsUser,
  handleAssignmentTaskSubmission,
  updateAssignmentTask,
} from '@services/courses/assignments';
import {
  useAssignmentsTask,
  useAssignmentsTaskDispatch,
} from '@components/Contexts/Assignments/AssignmentsTaskContext';
import AssignmentBoxUI from '@components/Objects/Activities/Assignment/AssignmentBoxUI';
import { useAssignments } from '@components/Contexts/Assignments/AssignmentContext';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';

// Types
interface QuizOption {
  optionUUID?: string;
  text: string;
  fileID: string;
  type: 'text' | 'image' | 'audio' | 'video';
  assigned_right_answer: boolean;
}

interface QuizQuestion {
  questionText: string;
  questionUUID?: string;
  options: QuizOption[];
}

interface QuizSubmission {
  questionUUID: string;
  optionUUID: string;
  answer: boolean;
}

interface QuizSubmitSchema {
  questions: QuizQuestion[];
  submissions: QuizSubmission[];
  assignment_task_submission_uuid?: string;
}

interface TaskQuizObjectProps {
  view: 'teacher' | 'student' | 'grading';
  user_id?: number;
  assignmentTaskUUID?: string;
}

// Constants
const MAX_QUESTIONS = 10;
const MAX_OPTIONS = 6;

// Helper to create a new question
const createQuestion = (): QuizQuestion => ({
  questionText: '',
  questionUUID: `question_${generateUUID()}`,
  options: [createOption()],
});

// Helper to create a new option
const createOption = (): QuizOption => ({
  text: '',
  fileID: '',
  type: 'text',
  assigned_right_answer: false,
  optionUUID: `option_${generateUUID()}`,
});

// Early returns preferred — do not normalize incoming API data here.
// Keep the UI defensive and bail out early when required data is missing.

// Sub-components
interface OptionLetterBadgeProps {
  index: number;
}

const OptionLetterBadge = ({ index }: OptionLetterBadgeProps) => (
  <div className="bg-muted text-muted-foreground flex h-full w-10 shrink-0 items-center justify-center rounded-l-lg font-semibold">
    {String.fromCodePoint(65 + index)}
  </div>
);

interface CorrectAnswerToggleProps {
  isCorrect: boolean;
  onClick?: () => void;
  readOnly?: boolean;
  t: (key: string) => string;
}

const CorrectAnswerToggle = ({ isCorrect, onClick, readOnly, t }: CorrectAnswerToggleProps) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant={isCorrect ? 'default' : 'secondary'}
            className={cn(
              'cursor-pointer gap-1 transition-colors',
              isCorrect
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-rose-100 text-rose-600 hover:bg-rose-200',
              readOnly && 'cursor-default',
            )}
            onClick={readOnly ? undefined : onClick}
          >
            {isCorrect ? <Check className="size-3" /> : <X className="size-3" />}
            <span className="text-xs font-medium">{isCorrect ? t('true') : t('false')}</span>
          </Badge>
        }
      />
      <TooltipContent>
        <p>{isCorrect ? t('markedAsTrue') : t('markedAsFalse')}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

interface SelectionIndicatorProps {
  isSelected: boolean;
  onClick?: () => void;
  interactive?: boolean;
}

const SelectionIndicator = ({ isSelected, onClick, interactive = false }: SelectionIndicatorProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!interactive}
    className={cn(
      'flex size-6 shrink-0 items-center justify-center rounded-md transition-all',
      isSelected ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground',
      interactive && 'hover:scale-105 active:scale-95',
    )}
  >
    {isSelected ? <Check className="size-3.5" /> : <X className="size-3.5 opacity-50" />}
  </button>
);

// Loading skeleton
const QuizSkeleton = () => (
  <div className="space-y-6">
    {[1, 2].map((q) => (
      <div
        key={q}
        className="space-y-3"
      >
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3].map((o) => (
          <Skeleton
            key={o}
            className="h-12 w-full"
          />
        ))}
      </div>
    ))}
  </div>
);

// Main component
const TaskQuizObject = ({ view, assignmentTaskUUID, user_id }: TaskQuizObjectProps) => {
  const t = useTranslations('DashPage.Assignments.TaskQuizObject');
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const assignmentTaskState = useAssignmentsTask();
  const assignmentTaskStateHook = useAssignmentsTaskDispatch();
  const assignment = useAssignments();

  // State
  const [isLoading, setIsLoading] = useState(view !== 'teacher');
  const [isSaving, setIsSaving] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => {
    if (view === 'teacher') {
      if (assignmentTaskState.assignmentTask.contents?.questions) {
        return assignmentTaskState.assignmentTask.contents.questions;
      }
      return [createQuestion()];
    }
    // For student/grading views start empty — we show a 'no questions' state instead of an editable empty draft
    return [];
  });
  const [userSubmissions, setUserSubmissions] = useState<QuizSubmitSchema>({
    questions: [],
    submissions: [],
  });
  const [initialUserSubmissions, setInitialUserSubmissions] = useState<QuizSubmitSchema>({
    questions: [],
    submissions: [],
  });
  const [assignmentTaskOutsideProvider, setAssignmentTaskOutsideProvider] = useState<any>(null);
  const [userSubmissionObject, setUserSubmissionObject] = useState<any>(null);

  // Computed values
  const showSavingDisclaimer = JSON.stringify(initialUserSubmissions.submissions) !== JSON.stringify(userSubmissions.submissions);

  const canAddQuestion = (questions?.length ?? 0) < MAX_QUESTIONS;

  // Helper to check if option is selected
  const isOptionSelected = useCallback(
    (questionUUID?: string, optionUUID?: string) => {
      return userSubmissions.submissions.some(
        (s) => s.questionUUID === questionUUID && s.optionUUID === optionUUID && s.answer,
      );
    },
    [userSubmissions.submissions],
  );

  // Question handlers
  const handleQuestionChange = useCallback((index: number, value: string) => {
    setQuestions((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], questionText: value };
      }
      return updated;
    });
  }, []);

  const handleOptionChange = useCallback((qIndex: number, oIndex: number, value: string) => {
    setQuestions((prev) => {
      const updated = [...prev];
      if (updated[qIndex]?.options[oIndex]) {
        updated[qIndex] = {
          ...updated[qIndex],
          options: updated[qIndex].options.map((opt, i) => (i === oIndex ? { ...opt, text: value } : opt)),
        };
      }
      return updated;
    });
  }, []);

  const addOption = useCallback((qIndex: number) => {
    setQuestions((prev) => {
      const updated = [...prev];
      if (updated[qIndex] && (updated[qIndex].options?.length ?? 0) < MAX_OPTIONS) {
        updated[qIndex] = {
          ...updated[qIndex],
          options: [...(updated[qIndex].options ?? []), createOption()],
        };
      }
      return updated;
    });
  }, []);

  const removeOption = useCallback(
    (qIndex: number, oIndex: number) => {
      setQuestions((prev) => {
        const updated = [...prev];
        if (updated[qIndex] && (updated[qIndex].options?.length ?? 0) > 1) {
          updated[qIndex] = {
            ...updated[qIndex],
            options: updated[qIndex].options!.filter((_, i) => i !== oIndex),
          };
          return updated;
        }
        toast.error(t('optionDeleteError'));
        return prev;
      });
    },
    [t],
  );

  const addQuestion = useCallback(() => {
    if (canAddQuestion) {
      setQuestions((prev) => [...prev, createQuestion()]);
    }
  }, [canAddQuestion]);

  const removeQuestion = useCallback((qIndex: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== qIndex));
  }, []);

  const toggleOption = useCallback((qIndex: number, oIndex: number) => {
    setQuestions((prev) => {
      const updated = [...prev];
      if (updated[qIndex]?.options[oIndex]) {
        updated[qIndex] = {
          ...updated[qIndex],
          options: updated[qIndex].options.map((opt, i) =>
            i === oIndex ? { ...opt, assigned_right_answer: !opt.assigned_right_answer } : opt,
          ),
        };
      }
      return updated;
    });
  }, []);

  // Student: choose option
  const chooseOption = useCallback(
    (qIndex: number, oIndex: number) => {
      const question = questions[qIndex];
      const option = question?.options[oIndex];

      if (!question?.questionUUID || !option?.optionUUID) return;

      const { questionUUID } = question;
      const { optionUUID } = option;

      setUserSubmissions((prev) => {
        const existing = prev.submissions.find((s) => s.questionUUID === questionUUID && s.optionUUID === optionUUID);

        if (!existing) {
          return {
            ...prev,
            submissions: [...prev.submissions, { questionUUID, optionUUID, answer: true }],
          };
        }

        return {
          ...prev,
          submissions: prev.submissions.map((s) =>
            s.questionUUID === questionUUID && s.optionUUID === optionUUID ? { ...s, answer: !s.answer } : s,
          ),
        };
      });
    },
    [questions],
  );

  // API calls
  const fetchAssignmentTask = useCallback(async () => {
    if (!assignmentTaskUUID) return;

    const res = await getAssignmentTask(assignmentTaskUUID, access_token);
    if (res.success) {
      setAssignmentTaskOutsideProvider(res.data);
      // If payload doesn't include questions, set an empty array for student/grading views so they show the "no questions" UI
      if (!res.data?.contents?.questions) {
        if (view !== 'teacher') setQuestions([]);
        return;
      }
      setQuestions(res.data.contents.questions);
    }
  }, [assignmentTaskUUID, access_token, view]);

  const fetchUserSubmission = useCallback(async () => {
    if (!assignmentTaskUUID) return;

    const res = await getAssignmentTaskSubmissionsMe(
      assignmentTaskUUID,
      assignment.assignment_object.assignment_uuid,
      access_token,
    );

    if (res.success && res.data?.task_submission) {
      const submission = {
        ...res.data.task_submission,
        assignment_task_submission_uuid: res.data.assignment_task_submission_uuid,
      };
      setUserSubmissions(submission);
      setInitialUserSubmissions(submission);
    } else {
      setUserSubmissions({ questions: [], submissions: [] });
      setInitialUserSubmissions({ questions: [], submissions: [] });
    }
  }, [assignmentTaskUUID, assignment.assignment_object.assignment_uuid, access_token]);

  const fetchIdentifiedUserSubmission = useCallback(async () => {
    if (!assignmentTaskUUID || !user_id) return;

    const res = await getAssignmentTaskSubmissionsUser(
      assignmentTaskUUID,
      user_id,
      assignment.assignment_object.assignment_uuid,
      access_token,
    );

    if (res.success && res.data?.task_submission) {
      const submission = {
        ...res.data.task_submission,
        assignment_task_submission_uuid: res.data.assignment_task_submission_uuid,
      };
      setUserSubmissions(submission);
      setInitialUserSubmissions(submission);
      setUserSubmissionObject(res.data);
    } else {
      setUserSubmissions({ questions: [], submissions: [] });
      setInitialUserSubmissions({ questions: [], submissions: [] });
      setUserSubmissionObject(null);
    }
  }, [assignmentTaskUUID, user_id, assignment.assignment_object.assignment_uuid, access_token]);

  // Save/Submit handlers
  const saveFC = async () => {
    setIsSaving(true);
    try {
      const res = await updateAssignmentTask(
        { contents: { questions } },
        assignmentTaskState.assignmentTask.assignment_task_uuid,
        assignment.assignment_object.assignment_uuid,
        access_token,
      );

      if (res) {
        assignmentTaskStateHook({ type: 'reload' });
        toast.success(t('saveSuccess'));
      } else {
        toast.error(t('saveError'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const submitFC = async () => {
    setIsSaving(true);
    try {
      // Early exit if there are no questions — nothing to submit
      if ((questions?.length ?? 0) === 0) {
        toast.error(t('noQuestionsFound'));
        return;
      }

      const updatedSubmissions: QuizSubmission[] = questions.flatMap((question) =>
        (question.options ?? []).map((option) => {
          const existing = userSubmissions.submissions.find(
            (s) => s.questionUUID === question.questionUUID && s.optionUUID === option.optionUUID,
          );
          return (
            existing || {
              questionUUID: question.questionUUID || '',
              optionUUID: option.optionUUID || '',
              answer: false,
            }
          );
        }),
      );

      const updatedUserSubmissions = {
        ...userSubmissions,
        submissions: updatedSubmissions,
      };

      const values = {
        assignment_task_submission_uuid: userSubmissions.assignment_task_submission_uuid || null,
        task_submission: updatedUserSubmissions,
        grade: 0,
        task_submission_grade_feedback: '',
      };

      if (assignmentTaskUUID) {
        const res = await handleAssignmentTaskSubmission(
          values,
          assignmentTaskUUID,
          assignment.assignment_object.assignment_uuid,
          access_token,
        );

        if (res) {
          assignmentTaskStateHook({ type: 'reload' });
          toast.success(t('saveSuccess'));

          const finalSubmissions = {
            ...updatedUserSubmissions,
            assignment_task_submission_uuid:
              res.data?.assignment_task_submission_uuid || userSubmissions.assignment_task_submission_uuid,
          };
          setUserSubmissions(finalSubmissions);
          setInitialUserSubmissions(finalSubmissions);
        } else {
          toast.error(t('saveError'));
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const gradeFC = async () => {
    if (!assignmentTaskUUID) return;

    setIsSaving(true);
    try {
      const maxPoints = assignmentTaskOutsideProvider?.max_grade_value || 100;
      const totalOptions = questions.reduce((total, q) => total + (q.options?.length ?? 0), 0);

      // Early-return if there are no options to grade (avoid division by zero)
      if (totalOptions === 0) {
        toast.error(t('noQuestionsFound'));
        return;
      }

      let correctAnswers = 0;
      questions.forEach((question) => {
        (question.options ?? []).forEach((option) => {
          const submission = userSubmissions.submissions.find(
            (s) => s.questionUUID === question.questionUUID && s.optionUUID === option.optionUUID,
          );
          if (submission?.answer === option.assigned_right_answer) {
            correctAnswers += 1;
          }
        });
      });

      const finalGrade = Math.round((correctAnswers / totalOptions) * maxPoints);

      const values = {
        assignment_task_submission_uuid: userSubmissions.assignment_task_submission_uuid,
        task_submission: userSubmissions,
        grade: finalGrade,
        task_submission_grade_feedback: t('autoGraded'),
      };

      const res = await handleAssignmentTaskSubmission(
        values,
        assignmentTaskUUID,
        assignment.assignment_object.assignment_uuid,
        access_token,
      );

      if (res) {
        fetchIdentifiedUserSubmission();
        toast.success(t('gradeSuccess', { finalGrade }));
      } else {
        toast.error(t('gradeError'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Effects
  useEffect(() => {
    if (view === 'teacher' && assignmentTaskUUID) {
      assignmentTaskStateHook({
        type: 'setSelectedAssignmentTaskUUID',
        payload: assignmentTaskUUID,
      });
    }
  }, [view, assignmentTaskUUID, assignmentTaskStateHook]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (view === 'student') {
          await Promise.all([fetchAssignmentTask(), fetchUserSubmission()]);
        } else if (view === 'grading') {
          await Promise.all([fetchAssignmentTask(), fetchIdentifiedUserSubmission()]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (view !== 'teacher') {
      loadData();
    }
  }, [view, fetchAssignmentTask, fetchUserSubmission, fetchIdentifiedUserSubmission]);

  // Render
  if (isLoading) {
    return (
      <AssignmentBoxUI
        view={view}
        type="quiz"
        submitFC={submitFC}
        saveFC={saveFC}
        gradeFC={gradeFC}
      >
        <QuizSkeleton />
      </AssignmentBoxUI>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-muted-foreground flex items-center justify-center gap-2 py-8">
          <Info className="size-4" />
          <p className="text-sm">{t('noQuestionsFound')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <AssignmentBoxUI
      submitFC={submitFC}
      saveFC={saveFC}
      gradeFC={gradeFC}
      view={view}
      currentPoints={userSubmissionObject?.grade}
      maxPoints={assignmentTaskOutsideProvider?.max_grade_value}
      showSavingDisclaimer={showSavingDisclaimer}
      type="quiz"
    >
      <div className="space-y-6">
        {questions.map((question, qIndex) => (
          <Card
            key={question.questionUUID || qIndex}
            className="border-border/50 overflow-hidden shadow-sm transition-shadow hover:shadow-md"
          >
            <CardContent className="space-y-4 p-4">
              {/* Question Header */}
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {qIndex + 1}
                </div>

                {view === 'teacher' ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      value={question.questionText}
                      onChange={(e) => handleQuestionChange(qIndex, e.target.value)}
                      placeholder={t('questionPlaceholder')}
                      className="flex-1 border-dashed font-medium"
                    />
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        }
                      />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('deleteQuestionTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>{t('deleteQuestionDescription')}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeQuestion(qIndex)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t('delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : (
                  <p className="text-foreground flex-1 pt-1.5 font-medium">{question.questionText}</p>
                )}
              </div>

              {/* Options */}
              <div className="space-y-2 pl-11">
                {(question.options ?? []).map((option, oIndex) => {
                  const isSelected = isOptionSelected(question.questionUUID, option.optionUUID);

                  return (
                    <div
                      key={option.optionUUID || oIndex}
                      className="flex gap-2"
                    >
                      <div
                        onClick={() => view === 'student' && chooseOption(qIndex, oIndex)}
                        className={cn(
                          'group flex flex-1 items-center overflow-hidden rounded-lg border bg-card transition-all',
                          view === 'student' &&
                            'cursor-pointer hover:border-primary/50 hover:shadow-sm active:scale-[0.99]',
                          view === 'student' && isSelected && 'border-emerald-400 ring-1 ring-emerald-400/20',
                        )}
                      >
                        <OptionLetterBadge index={oIndex} />

                        {view === 'teacher' ? (
                          <div className="flex flex-1 items-center gap-2 px-3 py-2">
                            <Input
                              value={option.text}
                              onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                              placeholder={t('optionPlaceholder')}
                              className="flex-1 border-dashed text-sm"
                            />
                            <CorrectAnswerToggle
                              isCorrect={option.assigned_right_answer}
                              onClick={() => toggleOption(qIndex, oIndex)}
                              t={t}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive size-7 shrink-0"
                              onClick={() => removeOption(qIndex, oIndex)}
                            >
                              <Minus className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-1 items-center justify-between gap-2 px-3 py-2.5">
                            <span className="text-foreground text-sm">{option.text}</span>

                            <div className="flex items-center gap-2">
                              {view === 'grading' && (
                                <CorrectAnswerToggle
                                  isCorrect={option.assigned_right_answer}
                                  readOnly
                                  t={t}
                                />
                              )}
                              <SelectionIndicator
                                isSelected={isSelected}
                                onClick={view === 'student' ? () => chooseOption(qIndex, oIndex) : undefined}
                                interactive={view === 'student'}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Add Option Button (Teacher only, last option) */}
                      {view === 'teacher' &&
                        oIndex === (question.options?.length ?? 1) - 1 &&
                        (question.options?.length ?? 0) < MAX_OPTIONS && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="size-[42px] shrink-0"
                                    onClick={() => addOption(qIndex)}
                                  >
                                    <Plus className="size-4" />
                                  </Button>
                                }
                              />
                              <TooltipContent>
                                <p>{t('addOption')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Question Button (Teacher only) */}
        {view === 'teacher' && canAddQuestion && (
          <Button
            variant="outline"
            className="text-muted-foreground hover:border-primary hover:text-primary w-full gap-2 border-dashed py-6"
            onClick={addQuestion}
          >
            <PlusCircle className="size-4" />
            {t('addQuestion')}
          </Button>
        )}
      </div>

      {/* Saving indicator overlay */}
      {isSaving && (
        <div className="bg-background/50 absolute inset-0 z-10 flex items-center justify-center rounded-lg backdrop-blur-sm">
          <div className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-5 animate-spin" />
            <span>{t('saving')}</span>
          </div>
        </div>
      )}
    </AssignmentBoxUI>
  );
};

export default TaskQuizObject;
