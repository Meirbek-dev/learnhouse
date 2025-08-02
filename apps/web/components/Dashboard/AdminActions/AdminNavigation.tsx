'use client';

import { Card, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import {
  BarChart3,
  Users,
  BookOpen,
  Settings,
  Shield,
  Database,
  Activity,
  PieChart,
  Monitor,
  Bell,
  TrendingUp,
  Zap,
  Target,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

interface AdminNavigationProps {
  currentPage: string;
  orgSlug: string;
  alertsCount?: number;
  className?: string;
}

export const AdminNavigation = ({
  currentPage,
  orgSlug,
  alertsCount = 0,
  className = ''
}: AdminNavigationProps) => {
  const t = useTranslations('DashPage.Admin.Navigation');
  const router = useRouter();

  const navigationItems = [
    {
      id: 'overview',
      title: t('overview'),
      description: t('overviewDescription'),
      icon: <BarChart3 className="h-5 w-5" />,
      href: `/orgs/${orgSlug}/admin/overview`,
      color: 'blue',
      featured: true
    },
    {
      id: 'analytics',
      title: t('analytics'),
      description: t('analyticsDescription'),
      icon: <PieChart className="h-5 w-5" />,
      href: `/orgs/${orgSlug}/admin/analytics`,
      color: 'purple'
    },
    {
      id: 'users',
      title: t('userManagement'),
      description: t('userManagementDescription'),
      icon: <Users className="h-5 w-5" />,
      href: `/orgs/${orgSlug}/admin/users`,
      color: 'green'
    },
    {
      id: 'courses',
      title: t('courseManagement'),
      description: t('courseManagementDescription'),
      icon: <BookOpen className="h-5 w-5" />,
      href: `/orgs/${orgSlug}/admin/courses`,
      color: 'orange'
    },
    {
      id: 'gamification',
      title: t('gamification'),
      description: t('gamificationDescription'),
      icon: <Zap className="h-5 w-5" />,
      href: `/orgs/${orgSlug}/admin/gamification`,
      color: 'yellow'
    },
    {
      id: 'retention',
      title: t('retention'),
      description: t('retentionDescription'),
      icon: <TrendingUp className="h-5 w-5" />,
      href: `/orgs/${orgSlug}/admin/retention`,
      color: 'indigo'
    },
    {
      id: 'realtime',
      title: t('realtime'),
      description: t('realtimeDescription'),
      icon: <Monitor className="h-5 w-5" />,
      href: `/orgs/${orgSlug}/admin/realtime`,
      color: 'red',
      badge: t('live')
    },
    {
      id: 'funnels',
      title: t('funnels'),
      description: t('funnelsDescription'),
      icon: <Target className="h-5 w-5" />,
      href: `/orgs/${orgSlug}/admin/funnels`,
      color: 'pink'
    },
    {
      id: 'alerts',
      title: t('alerts'),
      description: t('alertsDescription'),
      icon: <Bell className="h-5 w-5" />,
      href: `/orgs/${orgSlug}/admin/alerts`,
      color: 'red',
      badge: alertsCount > 0 ? alertsCount.toString() : undefined,
      urgent: alertsCount > 0
    },
    {
      id: 'system',
      title: t('system'),
      description: t('systemDescription'),
      icon: <Database className="h-5 w-5" />,
      href: `/orgs/${orgSlug}/admin/system`,
      color: 'gray'
    },
    {
      id: 'security',
      title: t('security'),
      description: t('securityDescription'),
      icon: <Shield className="h-5 w-5" />,
      href: `/orgs/${orgSlug}/admin/security`,
      color: 'blue'
    },
    {
      id: 'actions',
      title: t('actions'),
      description: t('actionsDescription'),
      icon: <Settings className="h-5 w-5" />,
      href: `/orgs/${orgSlug}/admin/actions`,
      color: 'gray'
    }
  ];

  const getColorClasses = (color: string, isActive: boolean) => {
    const colorMap = {
      blue: isActive
        ? 'border-blue-200 bg-blue-50 text-blue-900'
        : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50',
      purple: isActive
        ? 'border-purple-200 bg-purple-50 text-purple-900'
        : 'border-gray-200 hover:border-purple-200 hover:bg-purple-50',
      green: isActive
        ? 'border-green-200 bg-green-50 text-green-900'
        : 'border-gray-200 hover:border-green-200 hover:bg-green-50',
      orange: isActive
        ? 'border-orange-200 bg-orange-50 text-orange-900'
        : 'border-gray-200 hover:border-orange-200 hover:bg-orange-50',
      yellow: isActive
        ? 'border-yellow-200 bg-yellow-50 text-yellow-900'
        : 'border-gray-200 hover:border-yellow-200 hover:bg-yellow-50',
      indigo: isActive
        ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
        : 'border-gray-200 hover:border-indigo-200 hover:bg-indigo-50',
      red: isActive
        ? 'border-red-200 bg-red-50 text-red-900'
        : 'border-gray-200 hover:border-red-200 hover:bg-red-50',
      pink: isActive
        ? 'border-pink-200 bg-pink-50 text-pink-900'
        : 'border-gray-200 hover:border-pink-200 hover:bg-pink-50',
      gray: isActive
        ? 'border-gray-300 bg-gray-100 text-gray-900'
        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-100',
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.gray;
  };

  const getIconColor = (color: string, isActive: boolean) => {
    const colorMap = {
      blue: isActive ? 'text-blue-600' : 'text-blue-500',
      purple: isActive ? 'text-purple-600' : 'text-purple-500',
      green: isActive ? 'text-green-600' : 'text-green-500',
      orange: isActive ? 'text-orange-600' : 'text-orange-500',
      yellow: isActive ? 'text-yellow-600' : 'text-yellow-500',
      indigo: isActive ? 'text-indigo-600' : 'text-indigo-500',
      red: isActive ? 'text-red-600' : 'text-red-500',
      pink: isActive ? 'text-pink-600' : 'text-pink-500',
      gray: isActive ? 'text-gray-600' : 'text-gray-500',
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.gray;
  };

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  const featuredItems = navigationItems.filter(item => item.featured);
  const regularItems = navigationItems.filter(item => !item.featured);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">{t('adminDashboard')}</h1>
        <p className="text-gray-600">{t('adminDashboardDescription')}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">{t('totalUsers')}</p>
                <p className="text-2xl font-bold text-blue-600">1,234</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-900">{t('activeCourses')}</p>
                <p className="text-2xl font-bold text-green-600">56</p>
              </div>
              <BookOpen className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-900">{t('monthlyGrowth')}</p>
                <p className="text-2xl font-bold text-purple-600">+12%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className={`${alertsCount > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${alertsCount > 0 ? 'text-red-900' : 'text-gray-900'}`}>
                  {t('activeAlerts')}
                </p>
                <p className={`text-2xl font-bold ${alertsCount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {alertsCount}
                </p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${alertsCount > 0 ? 'text-red-600' : 'text-gray-600'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Featured Navigation Items */}
      {featuredItems.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{t('quickAccess')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <Card
                  key={item.id}
                  className={`cursor-pointer transition-all duration-200 ${getColorClasses(item.color, isActive)}`}
                  onClick={() => handleNavigation(item.href)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg bg-white ${getIconColor(item.color, isActive)}`}>
                          {item.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{item.title}</h3>
                            {item.badge && (
                              <Badge
                                variant={item.urgent ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {item.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm opacity-75 mt-1">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* All Navigation Items */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">{t('allSections')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {regularItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <Card
                key={item.id}
                className={`cursor-pointer transition-all duration-200 ${getColorClasses(item.color, isActive)}`}
                onClick={() => handleNavigation(item.href)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-white ${getIconColor(item.color, isActive)}`}>
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{item.title}</h3>
                        {item.badge && (
                          <Badge
                            variant={item.urgent ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm opacity-75">{item.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{t('quickActions')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="flex items-center gap-2 justify-start"
              onClick={() => handleNavigation(`/orgs/${orgSlug}/admin/users`)}
            >
              <Users className="h-4 w-4" />
              {t('manageUsers')}
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2 justify-start"
              onClick={() => handleNavigation(`/orgs/${orgSlug}/admin/courses`)}
            >
              <BookOpen className="h-4 w-4" />
              {t('manageCourses')}
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2 justify-start"
              onClick={() => handleNavigation(`/orgs/${orgSlug}/admin/analytics`)}
            >
              <BarChart3 className="h-4 w-4" />
              {t('viewAnalytics')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminNavigation;
