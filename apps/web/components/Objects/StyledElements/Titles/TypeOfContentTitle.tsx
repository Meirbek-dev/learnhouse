import CollectionsLogo from 'public/svg/collections.svg';
import CoursesLogo from 'public/svg/courses.svg';
import TrailLogo from 'public/svg/trail.svg';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

function TypeOfContentTitle({ title, type }: { title: string; type: string }) {
  const t = useTranslations('Components.TypeOfContentTitle');

  function getLogo() {
    if (type === 'col') return CollectionsLogo;
    if (type === 'cou') return CoursesLogo;
    if (type === 'tra') return TrailLogo;
    return;
  }

  let logoAltType = 'unknown';
  if (type === 'col') logoAltType = 'collection';
  else if (type === 'cou') logoAltType = 'course';
  else if (type === 'tra') logoAltType = 'trail';
  const logoAlt = t('logoAlt', { type: logoAltType });

  return (
    <div className="home_category_title my-5 flex items-center">
      <div className="my-auto mr-4 ml-2 rounded-full p-2 shadow-inner ring-1 ring-slate-900/5">
        <Image
          unoptimized
          src={getLogo()}
          alt={logoAlt}
        />
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
    </div>
  );
}

export default TypeOfContentTitle;
