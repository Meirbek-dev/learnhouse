'use client';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Backpack, Book, CreditCard, School, User, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import AppLink from '@/components/ui/AppLink';

interface BreadCrumbsProps {
  type: 'courses' | 'user' | 'users' | 'org' | 'orgusers' | 'assignments' | 'payments';
  last_breadcrumb?: string;
}

const BreadCrumbs = (props: BreadCrumbsProps) => {
  const t = useTranslations('DashPage');

  const getBreadcrumbIcon = (type: string) => {
    switch (type) {
      case 'courses': {
        return (
          <Book
            className="text-gray"
            size={14}
          />
        );
      }
      case 'assignments': {
        return (
          <Backpack
            className="text-gray"
            size={14}
          />
        );
      }
      case 'user': {
        return (
          <User
            className="text-gray"
            size={14}
          />
        );
      }
      case 'orgusers': {
        return (
          <Users
            className="text-gray"
            size={14}
          />
        );
      }
      case 'org': {
        return (
          <School
            className="text-gray"
            size={14}
          />
        );
      }
      case 'payments': {
        return (
          <CreditCard
            className="text-gray"
            size={14}
          />
        );
      }
      default: {
        return null;
      }
    }
  };

  const getBreadcrumbLink = (type: string) => {
    switch (type) {
      case 'courses': {
        return '/dash/courses';
      }
      case 'assignments': {
        return '/dash/assignments';
      }
      case 'user': {
        return '/dash/user-account/settings/general';
      }
      case 'orgusers': {
        return '/dash/users/settings/users';
      }
      case 'org': {
        return '/dash/users';
      }
      case 'payments': {
        return '/dash/payments';
      }
      default: {
        return '#';
      }
    }
  };

  const getBreadcrumbTitle = (type: string) => {
    switch (type) {
      case 'courses': {
        return t('Courses.title');
      }
      case 'assignments': {
        return t('Assignments.title');
      }
      case 'user': {
        return t('UserAccountSettings.title');
      }
      case 'orgusers': {
        return t('Card.Users.title');
      }
      case 'org': {
        return t('Card.Organization.title');
      }
      case 'payments': {
        return t('Payments.title');
      }
      default: {
        return '';
      }
    }
  };

  return (
    <div>
      <div className="h-7" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <AppLink
                href={getBreadcrumbLink(props.type)}
                className="flex items-center space-x-2"
              >
                {getBreadcrumbIcon(props.type)}
                <span>{getBreadcrumbTitle(props.type)}</span>
              </AppLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {props.last_breadcrumb ? (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="first-letter:uppercase">{props.last_breadcrumb}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : null}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};

export default BreadCrumbs;
