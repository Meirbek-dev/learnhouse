import {
  useAssignmentsTask,
  useAssignmentsTaskDispatch,
} from '@components/Contexts/Assignments/AssignmentsTaskContext';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import TaskQuizObject from './TaskTypes/TaskQuizObject';
import TaskFormObject from './TaskTypes/TaskFormObject';
import TaskFileObject from './TaskTypes/TaskFileObject';
import { useEffect } from 'react';

const AssignmentTaskContentEdit = () => {
  const session = useLHSession();
  const assignmentTaskStateHook = useAssignmentsTaskDispatch();
  const assignment_task = useAssignmentsTask();

  useEffect(() => {}, [
    assignment_task?.assignmentTask.assignment_type,
    assignment_task?.assignmentTask.assignment_task_uuid,
    assignmentTaskStateHook,
  ]);

  return (
    <div>
      {assignment_task?.assignmentTask.assignment_type === 'QUIZ' && (
        <TaskQuizObject
          view="teacher"
          assignmentTaskUUID={assignment_task?.assignmentTask.assignment_task_uuid}
        />
      )}
      {assignment_task?.assignmentTask.assignment_type === 'FILE_SUBMISSION' && (
        <TaskFileObject
          view="teacher"
          assignmentTaskUUID={assignment_task?.assignmentTask.assignment_task_uuid}
        />
      )}
      {assignment_task?.assignmentTask.assignment_type === 'FORM' && (
        <TaskFormObject
          view="teacher"
          assignmentTaskUUID={assignment_task?.assignmentTask.assignment_task_uuid}
        />
      )}
    </div>
  );
};

export default AssignmentTaskContentEdit;
