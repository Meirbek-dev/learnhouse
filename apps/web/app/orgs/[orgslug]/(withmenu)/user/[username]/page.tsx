import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getUserByUsername } from '@services/users/users';

import UserProfileClient from './UserProfileClient';

interface UserPageParams {
  username: string;
  orgslug: string;
}

interface UserPageProps {
  params: Promise<UserPageParams>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: UserPageProps): Promise<Metadata> {
  const t = await getTranslations('UserProfilePage');

  try {
    const resolvedParams = await params;
    const userData = await getUserByUsername(resolvedParams.username);

    return {
      title: t('metaTitle', {
        firstName: userData.first_name,
        lastName: userData.last_name,
      }),
      description:
        userData.bio ||
        t('metaDescriptionFallback', {
          firstName: userData.first_name,
          lastName: userData.last_name,
        }),
    };
  } catch {
    return {
      title: t('metaTitleError'),
    };
  }
}

async function UserPage({ params }: UserPageProps) {
  const t = await getTranslations('UserProfilePage');
  const resolvedParams = await params;
  const { username } = resolvedParams;

  try {
    const userData = await getUserByUsername(username);
    const profile = userData.profile
      ? typeof userData.profile === 'string'
        ? JSON.parse(userData.profile)
        : userData.profile
      : { sections: [] };

    return (
      <div>
        <UserProfileClient
          userData={userData}
          profile={profile}
        />
      </div>
    );
  } catch (error) {
    console.error('Error fetching user data:', error);
    return (
      <div className="container mx-auto py-8">
        <div className="nice-shadow rounded-xl bg-white p-6">
          <p className="text-red-600">{t('profileLoadError')}</p>
        </div>
      </div>
    );
  }
}

export default UserPage;
