'use client';

import FormLayout, {
  FormField,
  FormLabelAndMessage,
  Input,
  Textarea,
} from '@components/Objects/StyledElements/Form/Form';
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal';
import { createCourseUpdate, deleteCourseUpdate } from '@services/courses/updates';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useCourse } from '@components/Contexts/CourseContext';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import { useState, useLayoutEffect, useEffect } from 'react';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { PencilLine, Rss, TentTree } from 'lucide-react';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getAPIUrl } from '@services/config/config';
import * as Form from '@radix-ui/react-form';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import toast from 'react-hot-toast';
import { useFormik } from 'formik';
import dayjs from 'dayjs';

dayjs.extend(relativeTime);

function CourseUpdates() {
  const course = useCourse() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const { data: updates } = useSWR(`${getAPIUrl()}courses/${course?.courseStructure.course_uuid}/updates`, (url) =>
    swrFetcher(url, access_token),
  );
  const [isModelOpen, setIsModelOpen] = useState(false);
  const t = useTranslations('Courses.CourseUpdates');

  function handleModelOpen() {
    setIsModelOpen(!isModelOpen);
  }

  // if user clicks outside the model, close the model
  useLayoutEffect(() => {
    function handleClickOutside(event: any) {
      if (event.target.closest('.bg-white') || event.target.id === 'delete-update-button') return;
      setIsModelOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      style={{ position: 'relative' }}
      className="nice-shadow z-20 rounded-full bg-white px-5 py-1 transition-all ease-linear hover:bg-neutral-50"
    >
      <div
        onClick={handleModelOpen}
        className="flex items-center space-x-2 font-normal text-gray-600 hover:cursor-pointer"
      >
        <div>
          <Rss size={16} />{' '}
        </div>
        <div className="flex items-center space-x-2">
          <span>{t('updates')}</span>
          {updates && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-900">
              {updates.length}
            </span>
          )}
        </div>
      </div>
      {isModelOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 1300,
            damping: 70,
          }}
          style={{ position: 'absolute', top: '130%', right: 0 }}
        >
          <UpdatesSection />
        </motion.div>
      )}
    </div>
  );
}

const UpdatesSection = () => {
  const [selectedView, setSelectedView] = useState('list');
  const adminStatus = useAdminStatus();
  const t = useTranslations('Courses.CourseUpdates');
  return (
    <div className="nice-shadow w-[700px] overflow-hidden rounded-lg bg-white/95 backdrop-blur-md">
      <div className="flex justify-between rounded-lg bg-gray-50/70 outline-1 outline-neutral-200/40">
        <div className="flex items-center space-x-2 px-4 py-2 font-bold text-gray-500">
          <Rss size={16} />
          <span>{t('updates')}</span>
        </div>
        {adminStatus.isAdmin && (
          <div
            onClick={() => setSelectedView('new')}
            className="flex cursor-pointer items-center space-x-2 bg-gray-100 px-4 py-2 text-xs font-medium outline-1 outline-neutral-200/40 hover:bg-gray-200"
          >
            <PencilLine size={14} />
            <span>{t('newUpdate')}</span>
          </div>
        )}
      </div>
      <div className="">
        {selectedView === 'list' && <UpdatesListView />}
        {selectedView === 'new' && <NewUpdateForm setSelectedView={setSelectedView} />}
      </div>
    </div>
  );
};

const NewUpdateForm = ({ setSelectedView }: any) => {
  const org = useOrg() as any;
  const course = useCourse() as any;
  const session = useLHSession() as any;
  const t = useTranslations('Courses.CourseUpdates');

  const validate = (values: any) => {
    const errors: any = {};

    if (!values.title) {
      errors.title = t('titleRequired');
    }
    if (!values.content) {
      errors.content = t('contentRequired');
    }

    return errors;
  };
  const formik = useFormik({
    initialValues: {
      title: '',
      content: '',
    },
    validate,
    onSubmit: async (values) => {
      const body = {
        title: values.title,
        content: values.content,
        course_uuid: course.courseStructure.course_uuid,
        org_id: org.id,
      };
      const res = await createCourseUpdate(body, session.data?.tokens?.access_token);
      if (res.status === 200) {
        toast.success(t('updateAddedSuccess'));
        setSelectedView('list');
        mutate(`${getAPIUrl()}courses/${course?.courseStructure.course_uuid}/updates`);
      } else {
        toast.error(t('updateAddFailed'));
      }
    },
    enableReinitialize: true,
  });

  useEffect(() => {}, [course, org]);

  return (
    <div className="nice-shadow flex w-[700px] flex-col -space-y-2 overflow-hidden rounded-lg bg-white/95 backdrop-blur-md">
      <div className="flex flex-col -space-y-2 px-4 pt-4">
        <div className="rounded-full px-3 py-0.5 text-xs font-semibold text-gray-500">{t('testCourse')}</div>
        <div className="rounded-full px-3 py-0.5 text-lg font-bold text-black">{t('addNewCourseUpdate')}</div>
      </div>
      <div className="-py-2 px-5">
        <FormLayout onSubmit={formik.handleSubmit}>
          <FormField name="title">
            <FormLabelAndMessage
              label={t('title')}
              message={formik.errors.title}
            />
            <Form.Control asChild>
              <Input
                style={{ backgroundColor: 'white' }}
                onChange={formik.handleChange}
                value={formik.values.title}
                type="text"
                required
              />
            </Form.Control>
          </FormField>
          <FormField name="content">
            <FormLabelAndMessage
              label={t('content')}
              message={formik.errors.content}
            />
            <Form.Control asChild>
              <Textarea
                style={{ backgroundColor: 'white', height: '100px' }}
                onChange={formik.handleChange}
                value={formik.values.content}
                required
              />
            </Form.Control>
          </FormField>
          <div className="flex justify-end py-2">
            <button
              onClick={() => setSelectedView('list')}
              className="rounded-md px-4 py-2 text-sm font-bold text-gray-500 antialiased"
            >
              {t('cancel')}
            </button>
            <button className="rounded-md bg-black px-4 py-2 text-sm font-bold text-white antialiased">
              {t('addUpdate')}
            </button>
          </div>
        </FormLayout>
      </div>
    </div>
  );
};

const UpdatesListView = () => {
  const course = useCourse() as any;
  const adminStatus = useAdminStatus();
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const { data: updates } = useSWR(`${getAPIUrl()}courses/${course?.courseStructure?.course_uuid}/updates`, (url) =>
    swrFetcher(url, access_token),
  );
  const t = useTranslations('Courses.CourseUpdates');

  return (
    <div
      className="overflow-y-auto bg-white px-5"
      style={{ maxHeight: '400px' }}
    >
      {updates &&
        !adminStatus.loading &&
        updates.map((update: any) => (
          <div
            key={update.id}
            className="border-b border-neutral-200 py-2 antialiased"
          >
            <div className="flex items-center justify-between space-x-2 font-bold text-gray-500">
              <div className="flex items-center space-x-2">
                <span> {update.title}</span>
                <span
                  title={t('createdAtTooltipPrefix') + dayjs(update.creation_date).format('MMMM D, YYYY')}
                  className="text-xs font-semibold text-gray-300"
                >
                  {dayjs(update.creation_date).fromNow()}
                </span>
              </div>
              {adminStatus.isAdmin && !adminStatus.loading && <DeleteUpdateButton update={update} />}
            </div>
            <div className="text-gray-600">{update.content}</div>
          </div>
        ))}
      {(!updates || updates.length === 0) && (
        <div className="my-10 flex flex-col space-y-2 py-2 text-center text-gray-500">
          <TentTree
            className="mx-auto"
            size={40}
          />
          <p>{t('noUpdatesYet')}</p>
        </div>
      )}
    </div>
  );
};

const DeleteUpdateButton = ({ update }: any) => {
  const session = useLHSession() as any;
  const course = useCourse() as any;
  const _org = useOrg() as any;
  const t = useTranslations('Courses.CourseUpdates');

  const handleDelete = async () => {
    const res = await deleteCourseUpdate(
      course.courseStructure.course_uuid,
      update.courseupdate_uuid,
      session.data?.tokens?.access_token,
    );
    const toast_loading = toast.loading(t('deletingUpdate'));
    if (res.status === 200) {
      toast.dismiss(toast_loading);
      toast.success(t('successfullDelete'));
      mutate(`${getAPIUrl()}courses/${course?.courseStructure.course_uuid}/updates`);
    } else {
      toast.error(t('failedDelete'));
    }
  };

  return (
    <ConfirmationModal
      confirmationButtonText={t('deleteUpdate')}
      confirmationMessage={t('areYouSureYouWantToDeleteThisUpdate')}
      dialogTitle={t('deleteUpdate')}
      buttonid="delete-update-button"
      dialogTrigger={
        <div
          id="delete-update-button"
          className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-600 hover:cursor-pointer"
        >
          {t('delete')}
        </div>
      }
      functionToExecute={() => {
        handleDelete();
      }}
      status="warning"
    />
  );
};

export default CourseUpdates;
