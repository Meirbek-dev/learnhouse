'use client';
import {
  Shield,
  Users,
  BookOpen,
  UserCheck,
  Lock,
  Globe,
  Award,
  FileText,
  Crown,
  User,
  UserCog,
  GraduationCap,
  Eye,
  Edit,
  Trash2,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  ArrowLeft,
  AlertTriangle,
  Key,
  UserCheck as UserCheckIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { useOrg } from '@components/Contexts/OrgContext';
import { getUriWithOrg } from '@services/config/config';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { motion } from 'framer-motion';
import Link from 'next/link';
import React from 'react';

interface RightsDocumentationProps {
  params: Promise<{ orgslug: string }>;
}

const RightsDocumentation = ({ params }: RightsDocumentationProps) => {
  const org = useOrg() as any;

  const roleHierarchy = [
    {
      name: 'Admin',
      icon: <Crown className="w-6 h-6 text-purple-600" />,
      color: 'bg-purple-50 border-purple-200',
      description: 'Full platform control with all permissions',
      permissions: ['All permissions', 'Manage organization', 'Manage users', 'Manage courses', 'Manage roles'],
      level: 4,
    },
    {
      name: 'Maintainer',
      icon: <Shield className="w-6 h-6 text-blue-600" />,
      color: 'bg-blue-50 border-blue-200',
      description: 'Mid-level manager with wide permissions',
      permissions: ['Manage courses', 'Manage users', 'Manage assignments'],
      level: 3,
    },
    {
      name: 'Instructor',
      icon: <GraduationCap className="w-6 h-6 text-green-600" />,
      color: 'bg-green-50 border-green-200',
      description: 'Can create courses but need ownership for content creation',
      permissions: ['Create courses', 'Manage own courses', 'Create assignments', 'Grade assignments'],
      level: 2,
    },
    {
      name: 'User',
      icon: <User className="w-6 h-6 text-gray-600" />,
      color: 'bg-gray-50 border-gray-200',
      description: 'Read-Only Learner',
      permissions: ['View courses', 'Submit assignments', 'Take assessments'],
      level: 1,
    },
  ];

  const courseOwnershipTypes = [
    {
      name: 'Creator',
      icon: <Crown className="w-5 h-5 text-yellow-600" />,
      color: 'bg-yellow-50 border-yellow-200',
      description: 'Original course creator with full control',
      permissions: ['Full course control', 'Manage contributors', 'Change access settings', 'Delete course'],
    },
    {
      name: 'Maintainer',
      icon: <Shield className="w-5 h-5 text-blue-600" />,
      color: 'bg-blue-50 border-blue-200',
      description: 'Course maintainer with extensive permissions',
      permissions: ['Manage course content', 'Manage contributors', 'Change access settings', 'Cannot delete course'],
    },
    {
      name: 'Contributor',
      icon: <UserCog className="w-5 h-5 text-green-600" />,
      color: 'bg-green-50 border-green-200',
      description: 'Course contributor with limited permissions',
      permissions: ['Edit course content', 'Create activities', 'Cannot manage contributors', 'Cannot change access'],
    },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 pt-16 w-full">
      <div className="w-full max-w-none mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Icon */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-background rounded-full shadow-sm border border-border mb-6">
            <Shield className="w-8 h-8 text-primary" />
          </div>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-12"
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
              <ArrowLeft className="w-4 h-4" />
              <span className="font-medium text-muted-foreground">Back to Dashboard</span>
            </Link>
          </Button>
          <div className="flex items-center justify-center space-x-3 mb-4">
            <h1 className="text-4xl font-bold text-gray-900">Authorizations & Rights Guide</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Understanding LearnHouse permissions, roles, and access controls based on RBAC system
          </p>
        </motion.div>

        {/* Role Hierarchy Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-16"
        >
          <h2 className="text-2xl font-bold mb-8 text-center flex items-center justify-center space-x-2">
            <Crown className="w-6 h-6 text-purple-600" />
            <span>Role Hierarchy</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {roleHierarchy.map((role, index) => (
              <motion.div
                key={role.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
              >
                <Card
                  className={`hover:shadow-lg transition-all duration-200 hover:scale-[1.02] text-center h-full ${role.color}`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-center space-x-3 mb-2">
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
                          <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
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
          <h2 className="text-2xl font-bold mb-8 text-center flex items-center justify-center space-x-2">
            <Users className="w-6 h-6 text-primary" />
            <span>Course Ownership Types</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {courseOwnershipTypes.map((type, index) => (
              <motion.div
                key={type.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
              >
                <Card
                  className={`${type.color} hover:shadow-lg transition-all duration-200 hover:scale-[1.02] text-center h-full`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-center space-x-3 mb-2">
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
                          <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
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
