'use client';
import { Button } from '@components/ui/button';
import { useTranslations } from 'next-intl';

const NewCollectionButton = () => {
  const t = useTranslations('Components.Button');
  return (
    <Button className="my-auto space-x-1 rounded-lg px-5 py-2 font-semibold antialiased shadow-md transition-all duration-100 ease-out hover:scale-105 hover:shadow-lg focus:outline-none active:scale-95">
      <div>{t('newCollection')}</div>
      <div className="bg-primary-foreground/20 rounded-full px-1 text-sm font-medium">+</div>
    </Button>
  );
};

export default NewCollectionButton;
