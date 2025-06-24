'use client';
import { Backpack, Book, ChevronRight, CreditCard, School, User, Users } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface BreadCrumbsProps {
  type: 'courses' | 'user' | 'users' | 'org' | 'orgusers' | 'assignments' | 'payments';
  last_breadcrumb?: string;
}

function BreadCrumbs(props: BreadCrumbsProps) {
  const t = useTranslations('DashPage');

  return (
    <div>
      <div className="h-7" />
      <div className="flex space-x-1 text-sm font-medium tracking-tight text-gray-400">
        <div className="flex items-center space-x-1">
          {props.type == 'courses' ? (
            <div className="flex items-center space-x-2">
              {' '}
              <Book
                className="text-gray"
                size={14}
              />
              <Link href="/dash/courses">{t('Courses.title')}</Link>
            </div>
          ) : (
            ''
          )}
          {props.type == 'assignments' ? (
            <div className="flex items-center space-x-2">
              {' '}
              <Backpack
                className="text-gray"
                size={14}
              />
              <Link href="/dash/assignments">{t('Assignments.title')}</Link>
            </div>
          ) : (
            ''
          )}
          {props.type == 'user' ? (
            <div className="flex items-center space-x-2">
              {' '}
              <User
                className="text-gray"
                size={14}
              />
              <Link href="/dash/user-account/settings/general">{t('UserAccountSettings.title')}</Link>
            </div>
          ) : (
            ''
          )}
          {props.type == 'orgusers' ? (
            <div className="flex items-center space-x-2">
              {' '}
              <Users
                className="text-gray"
                size={14}
              />
              <Link href="/dash/users/settings/users">{t('Card.Users.title')}</Link>
            </div>
          ) : (
            ''
          )}

          {props.type == 'org' ? (
            <div className="flex items-center space-x-2">
              {' '}
              <School
                className="text-gray"
                size={14}
              />
              <Link href="/dash/users">{t('Card.Organization.title')}</Link>
            </div>
          ) : (
            ''
          )}
          {props.type == 'payments' ? (
            <div className="flex items-center space-x-2">
              {' '}
              <CreditCard
                className="text-gray"
                size={14}
              />
              <Link href="/dash/payments">{t('Payments.title')}</Link>
            </div>
          ) : (
            ''
          )}
          <div className="flex items-center space-x-1 first-letter:uppercase">
            {props.last_breadcrumb ? <ChevronRight size={17} /> : ''}
            <div className="first-letter:uppercase"> {props.last_breadcrumb}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BreadCrumbs;
