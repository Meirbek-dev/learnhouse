'use client'
import {
  Backpack,
  Book,
  ChevronRight,
  CreditCard,
  School,
  User,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { useTranslations } from 'next-intl'

type BreadCrumbsProps = {
  type:
    | 'courses'
    | 'user'
    | 'users'
    | 'org'
    | 'orgusers'
    | 'assignments'
    | 'payments'
  last_breadcrumb?: string
}

function BreadCrumbs(props: BreadCrumbsProps) {
  const t = useTranslations('DashPage')

  return (
    <div>
      <div className="h-7"></div>
      <div className="text-gray-400 tracking-tight font-medium text-sm flex space-x-1">
        <div className="flex items-center space-x-1">
          {props.type == 'courses' ? (
            <div className="flex space-x-2 items-center">
              {' '}
              <Book className="text-gray" size={14}></Book>
              <Link href="/dash/courses">{t('Courses.title')}</Link>
            </div>
          ) : (
            ''
          )}
          {props.type == 'assignments' ? (
            <div className="flex space-x-2 items-center">
              {' '}
              <Backpack className="text-gray" size={14}></Backpack>
              <Link href="/dash/assignments">{t('Assignments.title')}</Link>
            </div>
          ) : (
            ''
          )}
          {props.type == 'user' ? (
            <div className="flex space-x-2 items-center">
              {' '}
              <User className="text-gray" size={14}></User>
              <Link href="/dash/user-account/settings/general">
                {t('UserAccountSettings.title')}
              </Link>
            </div>
          ) : (
            ''
          )}
          {props.type == 'orgusers' ? (
            <div className="flex space-x-2 items-center">
              {' '}
              <Users className="text-gray" size={14}></Users>
              <Link href="/dash/users/settings/users">
                {t('Card.Users.title')}
              </Link>
            </div>
          ) : (
            ''
          )}

          {props.type == 'org' ? (
            <div className="flex space-x-2 items-center">
              {' '}
              <School className="text-gray" size={14}></School>
              <Link href="/dash/users">{t('Card.Organization.title')}</Link>
            </div>
          ) : (
            ''
          )}
          {props.type == 'payments' ? (
            <div className="flex space-x-2 items-center">
              {' '}
              <CreditCard className="text-gray" size={14}></CreditCard>
              <Link href="/dash/payments">{t('Payments.title')}</Link>
            </div>
          ) : (
            ''
          )}
          <div className="flex items-center space-x-1 first-letter:uppercase">
            {props.last_breadcrumb ? <ChevronRight size={17} /> : ''}
            <div className="first-letter:uppercase">
              {' '}
              {props.last_breadcrumb}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BreadCrumbs
