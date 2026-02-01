'use client';

import NewCourseButton from '@components/Objects/StyledElements/Buttons/NewCourseButton';
import CreateCourseModal from '@components/Objects/Modals/Course/Create/CreateCourse';
import { PermissionGuard, Actions, ResourceTypes } from '@/components/Security';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface CreateCourseTriggerProps {
  orgslug: string;
  org_id: number;
}

export default function CreateCourseTrigger({ orgslug, org_id }: CreateCourseTriggerProps) {
  const t = useTranslations('CoursesPage');
  const [newCourseModal, setNewCourseModal] = useState(false);

  function closeNewCourseModal() {
    setNewCourseModal(false);
  }

  return (
    <PermissionGuard
      action={Actions.CREATE}
      resource={ResourceTypes.COURSE}
      fallback={null}
    >
      <div>
        <NewCourseButton onClick={() => setNewCourseModal(true)} />
        <Modal
          isDialogOpen={newCourseModal}
          onOpenChange={setNewCourseModal}
          minHeight="md"
          dialogContent={
            <CreateCourseModal
              closeModal={closeNewCourseModal}
              orgslug={orgslug}
              org_id={org_id}
            />
          }
          dialogTitle={t('createCourse')}
          dialogDescription={t('createCourseDescription')}
        />
      </div>
    </PermissionGuard>
  );
}
