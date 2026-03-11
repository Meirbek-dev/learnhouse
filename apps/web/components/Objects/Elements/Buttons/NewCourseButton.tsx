'use client';
import { Button } from '@components/ui/button';
import { useTranslations } from 'next-intl';
import type { FC, ReactElement } from 'react';

interface NewCourseButtonProps {
  onClick?: () => void;
  render?: ReactElement;
}

const NewCourseButton: FC<NewCourseButtonProps> = ({ onClick, render }) => {
  const t = useTranslations('Components.Button');
  return (
    <Button
      type={render ? undefined : 'button'}
      render={render}
      onClick={onClick}
      className="my-auto gap-2 rounded-lg px-4 py-2 font-semibold"
    >
      <span>{t('newCourse')}</span>
      <span className="rounded-full border border-current/15 px-1.5 text-xs font-medium leading-5">+</span>
    </Button>
  );
};

export default NewCourseButton;
