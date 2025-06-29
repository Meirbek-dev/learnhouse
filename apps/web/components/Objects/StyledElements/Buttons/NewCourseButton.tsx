'use client';
import { Button } from '@components/ui/button';
import { useTranslations } from 'next-intl';
import type { FC } from 'react';

interface NewCourseButtonProps {
  onClick?: () => void;
}

const NewCourseButton: FC<NewCourseButtonProps> = ({ onClick }) => {
  const t = useTranslations('Components.Button');
  return (
    <Button
      type="button"
      onClick={onClick}
      className="my-auto space-x-1 rounded-lg px-4 py-2 font-bold antialiased shadow-md drop-shadow-lg transition-all duration-100 ease-out hover:scale-105 hover:shadow-lg focus:outline-none active:scale-95"
    >
      <div>{t('newCourse')}</div>
      <div className="bg-primary-foreground/20 rounded-full px-1 text-sm font-medium">+</div>
    </Button>
  );
};

export default NewCourseButton;
