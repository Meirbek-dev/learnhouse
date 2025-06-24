import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import HomeClient from './home';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('General');
  return {
    title: t('home'),
  };
}
function Home() {
  return (
    <div>
      <HomeClient />
    </div>
  );
}

export default Home;
