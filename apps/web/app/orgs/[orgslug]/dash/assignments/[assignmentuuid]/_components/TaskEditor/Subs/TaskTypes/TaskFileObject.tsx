import {
  getAssignmentTask,
  getAssignmentTaskSubmissionsMe,
  getAssignmentTaskSubmissionsUser,
  handleAssignmentTaskSubmission,
  updateSubFile,
} from '@services/courses/assignments';
import { useAssignmentsTaskDispatch } from '@components/Contexts/Assignments/AssignmentsTaskContext';
import AssignmentBoxUI from '@components/Objects/Activities/Assignment/AssignmentBoxUI';
import { useAssignments } from '@components/Contexts/Assignments/AssignmentContext';
import { Cloud, Download, File, Info, Loader, UploadCloud } from 'lucide-react';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { getTaskFileSubmissionDir } from '@services/media/media';
import { useOrg } from '@components/Contexts/OrgContext';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as React from 'react';
import Link from 'next/link';

type FileSchema = {
  fileUUID: string;
  assignment_task_submission_uuid?: string;
};

type TaskFileObjectProps = {
  view: 'teacher' | 'student' | 'grading' | 'custom-grading';
  assignmentTaskUUID?: string;
  user_id?: string;
};

export default function TaskFileObject({ view, user_id, assignmentTaskUUID }: TaskFileObjectProps) {
  const t = useTranslations('DashPage.Assignments.TaskFileObject');
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;
  const [isLoading, setIsLoading] = React.useState(false);
  const [localUploadFile, setLocalUploadFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [assignmentTask, setAssignmentTask] = React.useState<any>(null);
  const assignmentTaskStateHook = useAssignmentsTaskDispatch() as any;
  const assignment = useAssignments() as any;

  /* TEACHER VIEW CODE */
  /* TEACHER VIEW CODE */

  /* STUDENT VIEW CODE */
  const [showSavingDisclaimer, setShowSavingDisclaimer] = useState<boolean>(false);
  const [userSubmissions, setUserSubmissions] = useState<FileSchema>({
    fileUUID: '',
  });
  const [initialUserSubmissions, setInitialUserSubmissions] = useState<FileSchema>({
    fileUUID: '',
  });

  const handleFileChange = async (event: any) => {
    // Check if user is authenticated
    if (!access_token) {
      setError(t('authRequiredUpload'));
      return;
    }

    const file = event.target.files[0];

    setLocalUploadFile(file);
    setIsLoading(true);
    const res = await updateSubFile(
      file,
      assignmentTask.assignment_task_uuid,
      assignment.assignment_object.assignment_uuid,
      access_token,
    );

    // wait for 1.5 second to show loading animation
    await new Promise((r) => setTimeout(r, 1500));
    if (res.success === false) {
      setError(res.data.detail);
      setIsLoading(false);
    } else {
      assignmentTaskStateHook({ type: 'reload' });
      setUserSubmissions({
        fileUUID: res.data.file_uuid,
        assignment_task_submission_uuid: res.data.assignment_task_submission_uuid,
      });
      setIsLoading(false);
      setError('');
    }
  };

  const getAssignmentTaskSubmissionFromUserUI = useCallback(async () => {
    if (!access_token) {
      // Silently fail if not authenticated
      return;
    }

    if (assignmentTaskUUID) {
      const res = await getAssignmentTaskSubmissionsMe(
        assignmentTaskUUID,
        assignment.assignment_object.assignment_uuid,
        access_token,
      );
      if (res.success) {
        setUserSubmissions({
          ...res.data.task_submission,
          assignment_task_submission_uuid: res.data.assignment_task_submission_uuid,
        });
        setInitialUserSubmissions({
          ...res.data.task_submission,
          assignment_task_submission_uuid: res.data.assignment_task_submission_uuid,
        });
      }
    }
  }, [assignmentTaskUUID, assignment.assignment_object.assignment_uuid, access_token]);

  async function submitFC() {
    // Check if user is authenticated
    if (!access_token) {
      toast.error(t('authRequiredSubmit'));
      return;
    }

    // Save the quiz to the server
    const values = {
      assignment_task_submission_uuid: userSubmissions.assignment_task_submission_uuid,
      task_submission: userSubmissions,
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
        assignmentTaskStateHook({
          type: 'reload',
        });
        toast.success(t('saveSuccess'));
        setShowSavingDisclaimer(false);
      } else {
        toast.error(t('errorSaving'));
      }
    }
  }

  const getAssignmentTaskUI = useCallback(async () => {
    if (!access_token) {
      // Silently fail if not authenticated
      return;
    }

    if (assignmentTaskUUID) {
      const res = await getAssignmentTask(assignmentTaskUUID, access_token);
      if (res.success) {
        setAssignmentTask(res.data);
        setAssignmentTaskOutsideProvider(res.data);
      }
    }
  }, [assignmentTaskUUID, access_token]);

  const getAssignmentTaskSubmissionFromIdentifiedUserUI = useCallback(async () => {
    if (!access_token) {
      // Silently fail if not authenticated
      return;
    }

    if (assignmentTaskUUID && user_id) {
      const res = await getAssignmentTaskSubmissionsUser(
        assignmentTaskUUID,
        user_id,
        assignment.assignment_object.assignment_uuid,
        access_token,
      );
      if (res.success) {
        setUserSubmissions({
          ...res.data.task_submission,
          assignment_task_submission_uuid: res.data.assignment_task_submission_uuid,
        });
        setUserSubmissionObject(res.data);
        setInitialUserSubmissions({
          ...res.data.task_submission,
          assignment_task_submission_uuid: res.data.assignment_task_submission_uuid,
        });
      }
    }
  }, [assignmentTaskUUID, user_id, assignment.assignment_object.assignment_uuid, access_token]);

  // Detect changes between initial and current submissions
  useEffect(() => {
    if (userSubmissions.fileUUID !== initialUserSubmissions.fileUUID) {
      setShowSavingDisclaimer(true);
    } else {
      setShowSavingDisclaimer(false);
    }
  }, [userSubmissions, initialUserSubmissions.fileUUID]);

  /* STUDENT VIEW CODE */

  /* GRADING VIEW CODE */
  const [userSubmissionObject, setUserSubmissionObject] = useState<any>(null);

  async function gradeCustomFC(grade: number) {
    if (assignmentTaskUUID) {
      if (grade > assignmentTaskOutsideProvider.max_grade_value) {
        toast.error(
          t('gradeRangeError', {
            maxGradeValue: assignmentTaskOutsideProvider.max_grade_value,
          }),
        );
        return;
      }

      // Save the grade to the server
      const values = {
        assignment_task_submission_uuid: userSubmissions.assignment_task_submission_uuid,
        task_submission: userSubmissions,
        grade: grade,
        task_submission_grade_feedback: t('gradedByTeacher', {
          username: session.data.user.username,
        }),
      };

      const res = await handleAssignmentTaskSubmission(
        values,
        assignmentTaskUUID,
        assignment.assignment_object.assignment_uuid,
        access_token,
      );
      if (res) {
        getAssignmentTaskSubmissionFromIdentifiedUserUI();
        toast.success(t('gradeSuccess', { grade }));
      } else {
        toast.error(t('gradeError'));
      }
    }
  }

  /* GRADING VIEW CODE */
  const [assignmentTaskOutsideProvider, setAssignmentTaskOutsideProvider] = useState<any>(null);
  useEffect(() => {
    // Student area
    if (view === 'student') {
      getAssignmentTaskUI();
      getAssignmentTaskSubmissionFromUserUI();
    }

    // Grading area
    else if (view == 'custom-grading') {
      getAssignmentTaskUI();
      //setQuestions(assignmentTaskState.assignmentTask.contents.questions);
      getAssignmentTaskSubmissionFromIdentifiedUserUI();
    }
  }, [
    assignmentTaskUUID,
    view,
    assignment,
    access_token,
    user_id,
    getAssignmentTaskUI,
    getAssignmentTaskSubmissionFromUserUI,
    getAssignmentTaskSubmissionFromIdentifiedUserUI,
  ]);

  return (
    <AssignmentBoxUI
      submitFC={submitFC}
      showSavingDisclaimer={showSavingDisclaimer}
      view={view}
      gradeCustomFC={gradeCustomFC}
      currentPoints={userSubmissionObject?.grade}
      maxPoints={assignmentTaskOutsideProvider?.max_grade_value}
      type="file"
    >
      {view === 'teacher' && (
        <div className="mx-auto flex flex-col justify-center space-y-2 rounded-lg border border-slate-100 bg-slate-50 px-4 py-5 text-center text-xs text-slate-600 sm:flex-row sm:space-x-3 sm:space-y-0 sm:px-2 sm:py-6 sm:text-left sm:text-sm">
          <Info
            size={18}
            className="mx-auto text-slate-500 sm:mx-0"
          />
          <p className="ml-1">{t('teacherViewInfo')}</p>
        </div>
      )}
      {view === 'custom-grading' && (
        <div className="flex w-full flex-col space-y-4 px-2 sm:px-0">
          <div className="mx-auto flex flex-col justify-center space-y-2 rounded-lg border border-slate-100 bg-slate-50 px-4 py-5 text-center text-xs text-slate-600 sm:flex-row sm:space-x-3 sm:space-y-0 sm:px-2 sm:py-6 sm:text-left sm:text-sm">
            <Download
              size={18}
              className="mx-auto text-slate-500 sm:mx-0"
            />
            <p>{t('gradingViewInfo')}</p>
          </div>
          {userSubmissions.fileUUID && !isLoading && assignmentTaskUUID && (
            <Link
              href={getTaskFileSubmissionDir(
                org?.org_uuid,
                assignment.course_object.course_uuid,
                assignment.activity_object.activity_uuid,
                assignment.assignment_object.assignment_uuid,
                assignmentTaskUUID,
                userSubmissions.fileUUID,
              )}
              target="_blank"
              className="shadow-xs relative mx-auto flex w-full flex-col items-center space-y-1 rounded-lg border border-gray-100 bg-white px-4 py-4 text-gray-500 transition-shadow hover:shadow-md sm:w-auto sm:px-5"
            >
              <div className="shadow-xs absolute right-0 top-0 flex -translate-y-1/2 translate-x-1/2 transform items-center justify-center rounded-full bg-emerald-500 p-1.5 text-white">
                <Cloud size={14} />
              </div>

              <div className="mt-2 flex items-center space-x-2">
                <File
                  size={18}
                  className="text-emerald-500"
                />
                <div className="break-all text-xs font-medium uppercase sm:text-sm">
                  {`${userSubmissions.fileUUID.slice(0, 8)}...${userSubmissions.fileUUID.slice(-4)}`}
                </div>
              </div>
            </Link>
          )}
        </div>
      )}
      {view === 'student' && (
        <div className="shadow-xs min-h-[200px] w-full rounded-lg border border-gray-100 bg-white px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex h-full w-full flex-col items-center justify-center">
            <div className="flex w-full max-w-full flex-col items-center justify-center">
              <div className="flex w-full flex-col items-center justify-center">
                {error && (
                  <div className="shadow-xs mb-4 flex w-full items-center justify-center space-x-2 rounded-md border border-red-100 bg-red-50 p-3 text-red-600 transition-all sm:w-auto">
                    <div className="text-xs font-medium sm:text-sm">{error}</div>
                  </div>
                )}
              </div>
              {localUploadFile && !isLoading && (
                <div className="shadow-xs relative mt-3 flex w-full flex-col items-center space-y-1 rounded-lg border border-gray-100 bg-white px-4 py-4 text-gray-500 sm:w-auto sm:px-5">
                  <div className="shadow-xs absolute right-0 top-0 flex -translate-y-1/2 translate-x-1/2 transform items-center justify-center rounded-full bg-emerald-500 p-1.5 text-white">
                    <Cloud size={14} />
                  </div>

                  <div className="mt-2 flex items-center space-x-2">
                    <File
                      size={18}
                      className="text-emerald-500"
                    />
                    <div className="break-all text-xs font-medium uppercase sm:text-sm">
                      {localUploadFile.name.length > 20
                        ? `${localUploadFile.name.slice(0, 10)}...${localUploadFile.name.slice(-10)}`
                        : localUploadFile.name}
                    </div>
                  </div>
                </div>
              )}
              {userSubmissions.fileUUID && !isLoading && !localUploadFile && (
                <div className="shadow-xs relative mt-3 flex w-full flex-col items-center space-y-1 rounded-lg border border-gray-100 bg-white px-4 py-4 text-gray-500 sm:w-auto sm:px-5">
                  <div className="shadow-xs absolute right-0 top-0 flex -translate-y-1/2 translate-x-1/2 transform items-center justify-center rounded-full bg-emerald-500 p-1.5 text-white">
                    <Cloud size={14} />
                  </div>

                  <div className="mt-2 flex items-center space-x-2">
                    <File
                      size={18}
                      className="text-emerald-500"
                    />
                    <div className="break-all text-xs font-medium uppercase sm:text-sm">
                      {`${userSubmissions.fileUUID.slice(0, 8)}...${userSubmissions.fileUUID.slice(-4)}`}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-5 flex w-full flex-col items-center space-y-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 pt-5 text-center text-xs font-medium text-slate-500 sm:w-auto sm:flex-row sm:space-x-2 sm:space-y-0 sm:text-left">
                <Info
                  size={15}
                  className="mx-auto text-slate-400 sm:mx-0"
                />
                <p>{t('allowedFormats')}</p>
              </div>
              {!access_token ? (
                <div className="mt-5 flex w-full items-center justify-center">
                  <div className="shadow-xs flex w-full items-center justify-center space-x-2 rounded-md border border-amber-100 bg-amber-50 p-3 text-amber-600 transition-all sm:w-auto">
                    <Info
                      size={15}
                      className="text-amber-500"
                    />
                    <div className="text-xs font-medium sm:text-sm">{t('signInToUpload')}</div>
                  </div>
                </div>
              ) : isLoading ? (
                <div className="mt-5 flex w-full items-center justify-center">
                  <input
                    type="file"
                    id="fileInput"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <div className="flex animate-pulse items-center rounded-md bg-slate-100 px-4 py-2.5 text-xs font-medium text-slate-600 antialiased sm:px-5 sm:text-sm">
                    <Loader
                      size={15}
                      className="mr-2"
                    />
                    <span>{t('loading')}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex w-full items-center justify-center">
                  <input
                    type="file"
                    id={`fileInput_${assignmentTaskUUID}`}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <button
                    className="shadow-xs flex items-center rounded-md bg-emerald-500 px-4 py-2.5 text-xs font-medium text-white antialiased transition-colors hover:bg-emerald-600 sm:px-5 sm:text-sm"
                    onClick={() => document.getElementById(`fileInput_${assignmentTaskUUID}`)?.click()}
                  >
                    <UploadCloud
                      size={15}
                      className="mr-2"
                    />
                    <span>{t('submitFile')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AssignmentBoxUI>
  );
}
