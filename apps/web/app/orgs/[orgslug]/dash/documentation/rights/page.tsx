'use client';
import { ArrowLeft, CheckCircle, Crown, GraduationCap, Shield, User, UserCog, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { useOrg } from '@components/Contexts/OrgContext';
import { getUriWithOrg } from '@services/config/config';
import { Button } from '@components/ui/button';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface RightsDocumentationProps {
  params: Promise<{ orgslug: string }>;
}

const RightsDocumentation = ({ params }: RightsDocumentationProps) => {
  const org = useOrg() as any;
  const t = useTranslations('DashPage.Courses.RightsDocumentation');

  const roleHierarchy = [
    {
      name: t('roles.admin.name'),
      icon: <Crown className="h-6 w-6 text-purple-600" />,
      color: 'bg-purple-50 border-purple-200',
      description: t('roles.admin.description'),
      permissions: [
        t('roles.admin.permissions.allPermissions'),
        t('roles.admin.permissions.manageOrganization'),
        t('roles.admin.permissions.manageUsers'),
        t('roles.admin.permissions.manageCourses'),
        t('roles.admin.permissions.manageRoles'),
      ],
      level: 4,
    },
    {
      name: t('roles.maintainer.name'),
      icon: <Shield className="h-6 w-6 text-blue-600" />,
      color: 'bg-blue-50 border-blue-200',
      description: t('roles.maintainer.description'),
      permissions: [
        t('roles.maintainer.permissions.manageCourses'),
        t('roles.maintainer.permissions.manageUsers'),
        t('roles.maintainer.permissions.manageAssignments'),
      ],
      level: 3,
    },
    {
      name: t('roles.instructor.name'),
      icon: <GraduationCap className="h-6 w-6 text-green-600" />,
      color: 'bg-green-50 border-green-200',
      description: t('roles.instructor.description'),
      permissions: [
        t('roles.instructor.permissions.createCourses'),
        t('roles.instructor.permissions.manageOwnCourses'),
        t('roles.instructor.permissions.createAssignments'),
        t('roles.instructor.permissions.gradeAssignments'),
      ],
      level: 2,
    },
    {
      name: t('roles.user.name'),
      icon: <User className="h-6 w-6 text-gray-600" />,
      color: 'bg-gray-50 border-gray-200',
      description: t('roles.user.description'),
      permissions: [
        t('roles.user.permissions.viewCourses'),
        t('roles.user.permissions.submitAssignments'),
        t('roles.user.permissions.takeAssessments'),
      ],
      level: 1,
    },
  ];

  const courseOwnershipTypes = [
    {
      name: t('courseOwnership.creator.name'),
      icon: <Crown className="h-5 w-5 text-yellow-600" />,
      color: 'bg-yellow-50 border-yellow-200',
      description: t('courseOwnership.creator.description'),
      permissions: [
        t('courseOwnership.creator.permissions.fullCourseControl'),
        t('courseOwnership.creator.permissions.manageContributors'),
        t('courseOwnership.creator.permissions.changeAccessSettings'),
        t('courseOwnership.creator.permissions.deleteCourse'),
      ],
    },
    {
      name: t('courseOwnership.maintainer.name'),
      icon: <Shield className="h-5 w-5 text-blue-600" />,
      color: 'bg-blue-50 border-blue-200',
      description: t('courseOwnership.maintainer.description'),
      permissions: [
        t('courseOwnership.maintainer.permissions.manageCourseContent'),
        t('courseOwnership.maintainer.permissions.manageContributors'),
        t('courseOwnership.maintainer.permissions.changeAccessSettings'),
        t('courseOwnership.maintainer.permissions.cannotDeleteCourse'),
      ],
    },
    {
      name: t('courseOwnership.contributor.name'),
      icon: <UserCog className="h-5 w-5 text-green-600" />,
      color: 'bg-green-50 border-green-200',
      description: t('courseOwnership.contributor.description'),
      permissions: [
        t('courseOwnership.contributor.permissions.editCourseContent'),
        t('courseOwnership.contributor.permissions.createActivities'),
        t('courseOwnership.contributor.permissions.cannotManageContributors'),
        t('courseOwnership.contributor.permissions.cannotChangeAccess'),
      ],
    },
  ];

  return (
    <div className="bg-background flex min-h-screen w-full items-center justify-center p-6 pt-16">
      <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
        {/* Top Icon */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="border-border bg-background mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full border shadow-sm">
            <Shield className="text-primary h-8 w-8" />
          </div>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12 text-center"
        >
          <Button
            variant="ghost"
            asChild
            className="mb-6"
          >
            <Link
              href={getUriWithOrg(org?.slug, '/dash')}
              className="inline-flex items-center"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-muted-foreground font-medium">{t('backToDashboard')}</span>
            </Link>
          </Button>
          <div className="mb-4 flex items-center justify-center space-x-3">
            <h1 className="text-4xl font-bold text-gray-900">{t('title')}</h1>
          </div>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">{t('description')}</p>
        </motion.div>

        {/* Role Hierarchy Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-16"
        >
          <h2 className="mb-8 flex items-center justify-center space-x-2 text-center text-2xl font-bold">
            <Crown className="h-6 w-6 text-purple-600" />
            <span>{t('roleHierarchy')}</span>
          </h2>
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {roleHierarchy.map((role, index) => (
              <motion.div
                key={role.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
              >
                <Card
                  className={`h-full text-center transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${role.color}`}
                >
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-center space-x-3">
                      {role.icon}
                      <CardTitle className="text-lg">{role.name}</CardTitle>
                    </div>
                    <CardDescription>{role.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-left">
                      {role.permissions.map((permission, permIndex) => (
                        <li
                          key={permIndex}
                          className="flex items-center space-x-2 text-sm"
                        >
                          <CheckCircle className="h-3 w-3 shrink-0 text-green-600" />
                          <span>{permission}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Course Ownership Types */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-16"
        >
          <h2 className="mb-8 flex items-center justify-center space-x-2 text-center text-2xl font-bold">
            <Users className="text-primary h-6 w-6" />
            <span>{t('courseOwnershipTypes')}</span>
          </h2>
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
            {courseOwnershipTypes.map((type, index) => (
              <motion.div
                key={type.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
              >
                <Card
                  className={`${type.color} h-full text-center transition-all duration-200 hover:scale-[1.02] hover:shadow-lg`}
                >
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-center space-x-3">
                      {type.icon}
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                    </div>
                    <CardDescription>{type.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-left">
                      {type.permissions.map((permission, permIndex) => (
                        <li
                          key={permIndex}
                          className="flex items-center space-x-2 text-sm"
                        >
                          <CheckCircle className="h-3 w-3 shrink-0 text-green-600" />
                          <span>{permission}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default RightsDocumentation;
