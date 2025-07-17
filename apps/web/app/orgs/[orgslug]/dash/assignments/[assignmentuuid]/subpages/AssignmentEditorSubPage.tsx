'use client';

import { AssignmentsTaskProvider } from '@components/Contexts/Assignments/AssignmentsTaskContext';
import { AssignmentProvider } from '@components/Contexts/Assignments/AssignmentContext';
import { useTranslations } from 'next-intl';
import { LayoutList } from 'lucide-react';
import dynamic from 'next/dynamic';

import AssignmentTasks from '../_components/Tasks';

const AssignmentTaskEditor = dynamic(() => import('../_components/TaskEditor/TaskEditor'));

function AssignmentEditorSubPage({ assignmentuuid }: { assignmentuuid: string }) {
  const t = useTranslations('DashPage.Assignments');

  return (
    <AssignmentsTaskProvider>
      <div className="custom-dots-bg flex h-full w-[350px] flex-col flex-shrink-0">
        <div className="mx-auto my-5 flex items-center space-x-2 rounded-full bg-neutral-600/80 px-3.5 py-1 text-sm font-bold text-white">
          <LayoutList size={18} />
          <p>{t('tasks')}</p>
        </div>
        <div className="flex-1 min-h-0">
          <AssignmentTasks assignment_uuid={`assignment_${assignmentuuid}`} />
        </div>
      </div>
      <div className="soft-shadow flex h-full w-full flex-1 bg-[#fefcfe] min-h-0">
        <AssignmentProvider assignment_uuid={`assignment_${assignmentuuid}`}>
          <AssignmentTaskEditor page="general" />
        </AssignmentProvider>
      </div>
    </AssignmentsTaskProvider>
  );
}

export default AssignmentEditorSubPage;
