'use client';

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
import { Check, Info, Minus, Plus, PlusCircle, Type, X } from 'lucide-react';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { generateUUID } from '@/lib/utils';
import { toast } from 'sonner';

interface BlankSchema {
  blankUUID?: string;
  placeholder: string;
  correctAnswer: string;
  hint?: string;
}

interface FormSchema {
  questionText: string;
  questionUUID?: string;
  blanks: BlankSchema[];
}

interface SubmissionItem {
  questionUUID: string;
  blankUUID: string;
  answer: string;
}

interface FormSubmitSchema {
  questions: FormSchema[];
  submissions: SubmissionItem[];
  assignment_task_submission_uuid?: string;
}

// Helper functions for data normalization
const normalizeQuestion = (question: Partial<FormSchema>): FormSchema => ({
  questionText: question.questionText || '',
  questionUUID: question.questionUUID || `question_${generateUUID()}`,
  blanks: Array.isArray(question.blanks) ? question.blanks : [],
});

const normalizeQuestions = (questions: any[]): FormSchema[] => {
  if (!Array.isArray(questions)) return [];
  return questions.map(normalizeQuestion);
};

const normalizeSubmissions = (data: any): FormSubmitSchema => ({
  questions: normalizeQuestions(data?.questions),
  submissions: Array.isArray(data?.submissions) ? data.submissions : [],
  assignment_task_submission_uuid: data?.assignment_task_submission_uuid,
});

interface TaskFormObjectProps {
  view: 'teacher' | 'student' | 'grading';
  assignmentTaskUUID: string;
  user_id?: number;
}

function TaskFormObject({ view, assignmentTaskUUID, user_id }: TaskFormObjectProps) {
  const t = useTranslations('Components.TaskFormObject');
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const assignmentTaskState = useAssignmentsTask();
  const assignmentTaskStateHook = useAssignmentsTaskDispatch();
  const assignment = useAssignments();

  /* TEACHER VIEW CODE */
  const [questions, setQuestions] = useState<FormSchema[]>(() => {
    if (view === 'teacher') {
      const savedQuestions = assignmentTaskState.assignmentTask.contents?.questions;
      if (savedQuestions) {
        return normalizeQuestions(savedQuestions);
      }
      return [
        {
          questionText: '',
          questionUUID: `question_${generateUUID()}`,
          blanks: [
            {
              placeholder: t('blankPlaceholder'),
              correctAnswer: '',
              hint: '',
              blankUUID: `blank_${generateUUID()}`,
            },
          ],
        },
      ];
    }
    return [];
  });

  const handleQuestionChange = (index: number, value: string) => {
    const updatedQuestions = [...questions];
    if (updatedQuestions[index]) {
      updatedQuestions[index].questionText = value;
      setQuestions(updatedQuestions);
    }
  };

  const handleBlankChange = (
    qIndex: number,
    bIndex: number,
    field: 'placeholder' | 'correctAnswer' | 'hint',
    value: string,
  ) => {
    const updatedQuestions = [...questions];
    if (updatedQuestions[qIndex]?.blanks[bIndex]) {
      updatedQuestions[qIndex].blanks[bIndex][field] = value;
      setQuestions(updatedQuestions);
    }
  };

  const addBlank = (qIndex: number) => {
    const updatedQuestions = [...questions];
    if (updatedQuestions[qIndex]) {
      updatedQuestions[qIndex].blanks.push({
        placeholder: t('blankPlaceholder'),
        correctAnswer: '',
        hint: '',
        blankUUID: `blank_${generateUUID()}`,
      });
      setQuestions(updatedQuestions);
    }
  };

  const removeBlank = (qIndex: number, bIndex: number) => {
    const updatedQuestions = [...questions];
    if (updatedQuestions[qIndex] && updatedQuestions[qIndex].blanks.length > 1) {
      updatedQuestions[qIndex].blanks.splice(bIndex, 1);
      setQuestions(updatedQuestions);
    } else {
      toast.error(t('removeBlankError'));
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        questionText: '',
        questionUUID: `question_${generateUUID()}`,
        blanks: [
          {
            placeholder: t('blankPlaceholder'),
            correctAnswer: '',
            hint: '',
            blankUUID: `blank_${generateUUID()}`,
          },
        ],
      },
    ]);
  };

  const removeQuestion = (qIndex: number) => {
    const updatedQuestions = [...questions];
    updatedQuestions.splice(qIndex, 1);
    setQuestions(updatedQuestions);
  };

  const saveFC = async () => {
    // Save the form to the server
    const values = {
      contents: {
        questions,
      },
    };
    const res = await updateAssignmentTask(
      values,
      assignmentTaskState.assignmentTask.assignment_task_uuid,
      assignment.assignment_object.assignment_uuid,
      access_token,
    );
    if (res) {
      assignmentTaskStateHook({
        type: 'reload',
      });
      toast.success(t('savedSuccessfully'));
    } else {
      console.error('Save error:', res);
      toast.error(t('saveError'));
    }
  };

  /* STUDENT VIEW CODE */
  const [userSubmissions, setUserSubmissions] = useState<FormSubmitSchema>(normalizeSubmissions({}));
  const [initialUserSubmissions, setInitialUserSubmissions] = useState<FormSubmitSchema>(normalizeSubmissions({}));
  const [assignmentTaskOutsideProvider, setAssignmentTaskOutsideProvider] = useState<any>(null);
  const [userSubmissionObject, setUserSubmissionObject] = useState<any>(null);

  const showSavingDisclaimer = useMemo(() => {
    return JSON.stringify(userSubmissions) !== JSON.stringify(initialUserSubmissions);
  }, [userSubmissions, initialUserSubmissions]);

  const handleUserAnswerChange = (questionUUID: string, blankUUID: string, answer: string) => {
    setUserSubmissions((prev) => {
      const updatedSubmissions = [...prev.submissions];
      const existingIndex = updatedSubmissions.findIndex(
        (submission) => submission.questionUUID === questionUUID && submission.blankUUID === blankUUID,
      );

      if (existingIndex !== -1 && updatedSubmissions[existingIndex]) {
        updatedSubmissions[existingIndex]!.answer = answer;
      } else {
        updatedSubmissions.push({ questionUUID, blankUUID, answer });
      }

      return { ...prev, submissions: updatedSubmissions };
    });
  };

  const handleUserAnswerBlur = (questionUUID: string, blankUUID: string, answer: string) => {
    if (!answer.trim() || view !== 'student') return;

    const allBlanks = questions.flatMap((q) =>
      q.blanks.map((b) => ({ questionUUID: q.questionUUID, blankUUID: b.blankUUID })),
    );
    const currentIndex = allBlanks.findIndex((b) => b.questionUUID === questionUUID && b.blankUUID === blankUUID);
    const nextBlank = allBlanks[currentIndex + 1];

    if (nextBlank) {
      setTimeout(() => {
        const nextInput = document.querySelector(`[data-blank-id="${nextBlank.blankUUID}"]`) as HTMLInputElement;
        nextInput?.focus();
      }, 100);
    }
  };

  const submitFC = async () => {
    if (userSubmissions.submissions.length === 0) {
      toast.error(t('fillBlanksError'));
      return;
    }

    const values = {
      assignment_task_submission_uuid: userSubmissions.assignment_task_submission_uuid || null,
      task_submission: userSubmissions,
      grade: 0,
      task_submission_grade_feedback: '',
    };

    const res = await handleAssignmentTaskSubmission(
      values,
      assignmentTaskUUID,
      assignment.assignment_object.assignment_uuid,
      access_token,
    );

    if (res) {
      toast.success(t('submittedSuccessfully'));
      // Update userSubmissions with the returned UUID for future updates
      const updatedUserSubmissions = {
        ...userSubmissions,
        assignment_task_submission_uuid:
          res.data?.assignment_task_submission_uuid || userSubmissions.assignment_task_submission_uuid,
      };
      setUserSubmissions(updatedUserSubmissions);
      setInitialUserSubmissions(updatedUserSubmissions);
      // showSavingDisclaimer will automatically become false when submissions match
    } else {
      console.error('Submission error:', res);
      toast.error(t('submitError'));
    }
  };

  const gradeFC = async () => {
    if (!user_id) {
      toast.error(t('userIdRequired'));
      return;
    }

    // Calculate grade based on correct answers
    const allBlanks = questions.flatMap((q) => q.blanks.map((blank) => ({ ...blank, questionUUID: q.questionUUID })));

    const correctAnswers = allBlanks.filter((blank) => {
      const userAnswer = userSubmissions.submissions.find(
        (s) => s.questionUUID === blank.questionUUID && s.blankUUID === blank.blankUUID,
      );
      return userAnswer?.answer.toLowerCase().trim() === blank.correctAnswer.toLowerCase().trim();
    }).length;

    const maxPoints = assignmentTaskOutsideProvider?.max_grade_value || 100;
    const finalGrade = allBlanks.length > 0 ? Math.round((correctAnswers / allBlanks.length) * maxPoints) : 0;

    // Save the grade to the server
    const values = {
      assignment_task_submission_uuid: userSubmissions.assignment_task_submission_uuid,
      task_submission: userSubmissions,
      grade: finalGrade,
      task_submission_grade_feedback: t('autoGradedBySystem'),
    };

    const res = await handleAssignmentTaskSubmission(
      values,
      assignmentTaskUUID,
      assignment.assignment_object.assignment_uuid,
      access_token,
    );
    if (res) {
      getAssignmentTaskSubmissionFromIdentifiedUserUI();
      toast.success(t('gradedSuccessfully', { finalGrade, correctAnswers, totalBlanks: allBlanks.length }));
    } else {
      toast.error(t('gradeError'));
    }
  };

  const getAssignmentTaskSubmissionFromIdentifiedUserUI = useCallback(async () => {
    if (!(access_token && user_id)) {
      return;
    }

    if (assignmentTaskUUID) {
      const res = await getAssignmentTaskSubmissionsUser(
        assignmentTaskUUID,
        user_id,
        assignment.assignment_object.assignment_uuid,
        access_token,
      );
      if (res.success) {
        const normalizedData = normalizeSubmissions({
          ...res.data.task_submission,
          assignment_task_submission_uuid: res.data.assignment_task_submission_uuid,
        });
        setUserSubmissions(normalizedData);
        setInitialUserSubmissions(normalizedData);
        setUserSubmissionObject(res.data);
      }
    }
  }, [access_token, user_id, assignmentTaskUUID, assignment.assignment_object.assignment_uuid]);

  const loadAssignmentTask = useCallback(async () => {
    if (!assignmentTaskUUID) return;

    const res = await getAssignmentTask(assignmentTaskUUID, access_token);
    if (res.success) {
      setAssignmentTaskOutsideProvider(res.data);
      const normalizedQuestions = normalizeQuestions(res.data.contents?.questions);

      // Only update questions for student/grading view, or if teacher has saved questions
      if (view !== 'teacher' || normalizedQuestions.length > 0) {
        setQuestions(normalizedQuestions);
      }
    }
  }, [assignmentTaskUUID, access_token, view]);

  const loadUserSubmissions = useCallback(async () => {
    if (view !== 'student' || !assignmentTaskUUID) return;

    const res = await getAssignmentTaskSubmissionsMe(
      assignmentTaskUUID,
      assignment.assignment_object.assignment_uuid,
      access_token,
    );
    if (res.success) {
      const normalizedData = normalizeSubmissions({
        ...res.data.task_submission,
        assignment_task_submission_uuid: res.data.assignment_task_submission_uuid,
      });
      setUserSubmissions(normalizedData);
      setInitialUserSubmissions(normalizedData);
    }
  }, [view, assignmentTaskUUID, assignment.assignment_object.assignment_uuid, access_token]);

  // Set assignment task UUID in context - separate effect to avoid dependency issues
  useEffect(() => {
    if (assignmentTaskUUID) {
      assignmentTaskStateHook({
        type: 'setSelectedAssignmentTaskUUID',
        payload: assignmentTaskUUID,
      });
    }
  }, [assignmentTaskUUID, assignmentTaskStateHook]);

  useEffect(() => {
    if (view === 'teacher') {
      // Questions are initialized via lazy initialization in useState
      // Only load task if no saved questions exist
      if (!assignmentTaskState.assignmentTask.contents?.questions) {
        void Promise.resolve().then(() => loadAssignmentTask());
      }
    } else if (view === 'student') {
      void Promise.resolve().then(() => loadAssignmentTask());
      void Promise.resolve().then(() => loadUserSubmissions());
    } else if (view === 'grading') {
      void Promise.resolve().then(() => loadAssignmentTask());
      void Promise.resolve().then(() => getAssignmentTaskSubmissionFromIdentifiedUserUI());
    }
  }, [
    assignmentTaskState.assignmentTask.contents?.questions,
    view,
    assignmentTaskUUID,
    user_id,
    access_token,
    assignment.assignment_object.assignment_uuid,
    loadAssignmentTask,
    loadUserSubmissions,
    getAssignmentTaskSubmissionFromIdentifiedUserUI,
  ]);

  // Show main UI for teacher view (always has at least the default question)
  // or when questions exist for other views
  if (view === 'teacher' || (questions && questions.length > 0)) {
    return (
      <AssignmentBoxUI
        submitFC={submitFC}
        saveFC={saveFC}
        gradeFC={gradeFC}
        view={view}
        currentPoints={userSubmissionObject?.grade}
        maxPoints={assignmentTaskOutsideProvider?.max_grade_value}
        showSavingDisclaimer={showSavingDisclaimer}
        type="form"
      >
        {view === 'grading' &&
          (() => {
            const allBlanks = questions.flatMap((q) => q.blanks);
            const correctCount = allBlanks.filter((blank) => {
              const userAnswer = userSubmissions.submissions.find((s) => s.blankUUID === blank.blankUUID);
              return userAnswer?.answer.toLowerCase().trim() === blank.correctAnswer.toLowerCase().trim();
            }).length;

            return (
              <div className="mb-6 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-800">{t('submissionSummary')}</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{allBlanks.length}</div>
                    <div className="text-gray-600">{t('totalBlanks')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{correctCount}</div>
                    <div className="text-gray-600">{t('correct')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-600">{allBlanks.length - correctCount}</div>
                    <div className="text-gray-600">{t('incorrect')}</div>
                  </div>
                </div>
              </div>
            );
          })()}
        <div className="flex flex-col space-y-6">
          {questions?.map((question, qIndex) => (
            <div
              key={qIndex}
              className="flex flex-col space-y-1.5"
            >
              <div className="flex items-center space-x-2">
                {view === 'teacher' ? (
                  <input
                    value={question.questionText}
                    onChange={(e) => handleQuestionChange(qIndex, e.target.value)}
                    placeholder={t('questionPlaceholder')}
                    className="w-full rounded-md border-2 border-dotted border-gray-200 bg-[#00008b00] px-3 text-sm font-bold text-neutral-600"
                  />
                ) : (
                  <p className="w-full rounded-md border-2 border-dotted border-gray-200 bg-[#00008b00] px-3 text-sm font-bold text-neutral-600">
                    {question.questionText}
                  </p>
                )}
                {view === 'teacher' && (
                  <div
                    className="flex h-[20px] w-[20px] flex-none cursor-pointer items-center rounded-lg bg-slate-200/60 text-sm text-slate-500 transition-all ease-linear hover:bg-slate-300"
                    onClick={() => removeQuestion(qIndex)}
                  >
                    <Minus
                      size={12}
                      className="mx-auto"
                    />
                  </div>
                )}
              </div>

              {/* Blanks section */}
              <div className="flex flex-col space-y-2">
                {question.blanks.map((blank, bIndex) => (
                  <div
                    key={bIndex}
                    className="flex"
                  >
                    <div
                      className={
                        'blank-item soft-shadow flex min-h-[40px] w-full items-center space-x-2 rounded-lg bg-white pr-2 text-sm shadow-sm outline-3 outline-white duration-150 ease-linear hover:bg-opacity-100 hover:shadow-md' +
                        (view === 'student' ? 'active:scale-105' : '')
                      }
                    >
                      <div className="flex h-full w-[40px] items-center justify-center rounded-l-md bg-slate-100/80 text-base font-bold text-slate-800">
                        <Type size={14} />
                      </div>
                      {view === 'teacher' ? (
                        <div className="flex w-full flex-col space-y-1 py-2">
                          <input
                            value={blank.placeholder}
                            onChange={(e) => handleBlankChange(qIndex, bIndex, 'placeholder', e.target.value)}
                            placeholder={t('placeholderText')}
                            className="mx-2 w-full rounded-md border-2 border-dotted border-gray-200 bg-[#00008b00] px-3 pr-6 text-sm font-bold text-neutral-600"
                          />
                          <input
                            value={blank.correctAnswer}
                            onChange={(e) => handleBlankChange(qIndex, bIndex, 'correctAnswer', e.target.value)}
                            placeholder={t('correctAnswerPlaceholder')}
                            className="mx-2 w-full rounded-md border-2 border-dotted border-lime-200 bg-lime-50 px-3 pr-6 text-sm font-bold text-neutral-600"
                          />
                          <input
                            value={blank.hint || ''}
                            onChange={(e) => handleBlankChange(qIndex, bIndex, 'hint', e.target.value)}
                            placeholder={t('hintOptional')}
                            className="mx-2 w-full rounded-md border-2 border-dotted border-blue-200 bg-blue-50 px-3 pr-6 text-xs text-neutral-600"
                          />
                        </div>
                      ) : view === 'grading' ? (
                        <div className="flex w-full flex-col space-y-1 py-2">
                          <div className="mx-2 flex w-full items-center space-x-2">
                            <input
                              value={
                                userSubmissions.submissions.find(
                                  (submission) =>
                                    submission.questionUUID === question.questionUUID &&
                                    submission.blankUUID === blank.blankUUID,
                                )?.answer || ''
                              }
                              readOnly
                              className="flex-1 rounded-md border-2 border-gray-200 bg-gray-50 px-3 pr-6 text-sm font-bold text-neutral-600"
                            />
                          </div>
                          <div className="mx-2 text-xs text-gray-600">
                            <span className="font-semibold">{t('expected')}</span> {blank.correctAnswer}
                          </div>
                          {blank.hint && (
                            <div className="mx-2 text-xs text-blue-600 italic">
                              {t('hintIcon')} {blank.hint}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex w-full flex-col space-y-1 py-2">
                          <input
                            value={
                              userSubmissions.submissions.find(
                                (submission) =>
                                  submission.questionUUID === question.questionUUID &&
                                  submission.blankUUID === blank.blankUUID,
                              )?.answer || ''
                            }
                            onChange={(e) =>
                              handleUserAnswerChange(question.questionUUID!, blank.blankUUID!, e.target.value)
                            }
                            onBlur={(e) =>
                              handleUserAnswerBlur(question.questionUUID!, blank.blankUUID!, e.target.value)
                            }
                            placeholder={blank.placeholder}
                            data-blank-id={blank.blankUUID}
                            className="mx-2 w-full rounded-md border-2 border-gray-200 bg-[#00008b00] px-3 pr-6 text-sm font-bold text-neutral-600 transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                          />
                          {blank.hint && (
                            <div className="mx-2 text-xs text-blue-600 italic">
                              {t('hintIcon')} {blank.hint}
                            </div>
                          )}
                        </div>
                      )}
                      {view === 'teacher' && (
                        <div
                          className="flex h-[20px] w-[20px] flex-none cursor-pointer items-center rounded-lg bg-slate-200/60 text-sm text-slate-500 transition-all ease-linear hover:bg-slate-300"
                          onClick={() => removeBlank(qIndex, bIndex)}
                        >
                          <Minus
                            size={12}
                            className="mx-auto"
                          />
                        </div>
                      )}
                      {view === 'grading' && (
                        <div
                          className={`flex h-fit w-fit flex-none items-center space-x-1 rounded-lg px-2 py-0.5 text-xs ${
                            userSubmissions.submissions
                              .find(
                                (submission) =>
                                  submission.questionUUID === question.questionUUID &&
                                  submission.blankUUID === blank.blankUUID,
                              )
                              ?.answer?.toLowerCase()
                              .trim() === blank.correctAnswer.toLowerCase().trim()
                              ? 'bg-lime-200 text-lime-600'
                              : 'bg-rose-200/60 text-rose-500'
                          } text-sm`}
                        >
                          {userSubmissions.submissions
                            .find(
                              (submission) =>
                                submission.questionUUID === question.questionUUID &&
                                submission.blankUUID === blank.blankUUID,
                            )
                            ?.answer?.toLowerCase()
                            .trim() === blank.correctAnswer.toLowerCase().trim() ? (
                            <>
                              <Check
                                size={12}
                                className="mx-auto"
                              />
                              <p className="mx-auto text-xs font-bold">{t('correct')}</p>
                            </>
                          ) : (
                            <>
                              <X
                                size={12}
                                className="mx-auto"
                              />
                              <p className="mx-auto text-xs font-bold">{t('incorrect')}</p>
                            </>
                          )}
                        </div>
                      )}
                      {view === 'student' && (
                        <div
                          className={`flex h-[20px] w-[20px] flex-none items-center rounded-lg ${
                            userSubmissions.submissions
                              .find(
                                (submission) =>
                                  submission.questionUUID === question.questionUUID &&
                                  submission.blankUUID === blank.blankUUID,
                              )
                              ?.answer?.trim()
                              ? 'bg-green-200/60 text-green-500'
                              : 'bg-slate-200/60 text-slate-500'
                          } text-sm transition-all ease-linear`}
                        >
                          {userSubmissions.submissions
                            .find(
                              (submission) =>
                                submission.questionUUID === question.questionUUID &&
                                submission.blankUUID === blank.blankUUID,
                            )
                            ?.answer?.trim() ? (
                            <Check
                              size={12}
                              className="mx-auto"
                            />
                          ) : (
                            <X
                              size={12}
                              className="mx-auto"
                            />
                          )}
                        </div>
                      )}
                    </div>
                    {view === 'teacher' && bIndex === question.blanks.length - 1 && question.blanks.length <= 4 && (
                      <div className="mx-auto flex justify-center px-2">
                        <div
                          className="soft-shadow hover:bg-opacity-100 flex h-[40px] w-full cursor-pointer items-center rounded-lg bg-white px-2 shadow-sm outline-3 outline-white duration-150 ease-linear hover:shadow-md"
                          onClick={() => addBlank(qIndex)}
                        >
                          <Plus
                            size={14}
                            className="inline-block"
                          />
                          <span />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {view === 'teacher' && questions.length <= 5 && (
          <div className="mx-auto flex justify-center px-2">
            <div
              className="soft-shadow text-slate my-2 flex w-full cursor-pointer items-center space-x-3 rounded-md bg-white px-4 py-2 text-xs transition duration-150 ease-linear hover:shadow-xs"
              onClick={addQuestion}
            >
              <PlusCircle
                size={14}
                className="inline-block"
              />
              <span>{t('addQuestion')}</span>
            </div>
          </div>
        )}
      </AssignmentBoxUI>
    );
  }

  return (
    <div className="flex flex-row items-center space-x-2 text-sm">
      <Info size={12} />
      <p>{t('noQuestionsFound')}</p>
    </div>
  );
}

export default TaskFormObject;
