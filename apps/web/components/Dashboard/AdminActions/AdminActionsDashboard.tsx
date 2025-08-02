'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@components/ui/dialog';
import { Checkbox } from '@components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { Alert, AlertDescription } from '@components/ui/alert';
import { ScrollArea } from '@components/ui/scroll-area';
import { Progress } from '@components/ui/progress';
import {
  Users,
  Settings,
  Shield,
  BookOpen,
  Database,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  UserCheck,
  UserX,
  RotateCcw,
  Mail,
  FileText,
  Monitor,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Filter
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useCallback } from 'react';
import useSWR from 'swr';
import type { BulkOperationResult, AdminUser, AdminCourse, UserListResponse, CourseListResponse } from '@services/admin/admin';
import { getAdminUsers, getAdminCourses } from '@services/admin/admin';

interface AdminActionsDashboardProps {
  orgId: number;
  accessToken: string;
  onBulkUserOperation?: (action: string, userIds: number[]) => Promise<BulkOperationResult>;
  onBulkCourseOperation?: (action: string, courseIds: number[]) => Promise<BulkOperationResult>;
  onSystemAction?: (action: string, params?: any) => Promise<any>;
}

// Type definitions for backward compatibility with existing code
interface User extends AdminUser {}
interface Course extends AdminCourse {}

export const AdminActionsDashboard = ({
  orgId,
  accessToken,
  onBulkUserOperation,
  onBulkCourseOperation,
  onSystemAction
}: AdminActionsDashboardProps) => {
  const t = useTranslations('DashPage.Admin.Actions');

  // User Management State
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [isPerformingAction, setIsPerformingAction] = useState(false);
  const [actionResult, setActionResult] = useState<BulkOperationResult | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState<string>('all');

  // Course Management State
  const [selectedCourses, setSelectedCourses] = useState<number[]>([]);
  const [courseAction, setCourseAction] = useState<string>('');
  const [courseSearchTerm, setCourseSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  // System Actions State
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch users and courses data
  const { data: usersData, error: usersError, mutate: mutateUsers } = useSWR<UserListResponse>(
    ['admin-users', orgId, userSearchTerm, userFilter],
    () => getAdminUsers(orgId, accessToken, 1, 100, userSearchTerm || undefined, userFilter !== 'all' ? userFilter : undefined),
    {
      revalidateOnFocus: false,
      errorRetryCount: 3
    }
  );

  const { data: coursesData, error: coursesError, mutate: mutateCourses } = useSWR<CourseListResponse>(
    ['admin-courses', orgId, courseSearchTerm, courseFilter],
    () => getAdminCourses(orgId, accessToken, 1, 100, courseSearchTerm || undefined, courseFilter !== 'all' ? courseFilter : undefined),
    {
      revalidateOnFocus: false,
      errorRetryCount: 3
    }
  );

  // Extract data with fallbacks
  const users: User[] = usersData?.users || [];
  const courses: Course[] = coursesData?.courses || [];

  // Apply filtering based on search terms and filters
  const filteredUsers = users.filter(user => {
    const matchesSearch = !userSearchTerm ||
      user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearchTerm.toLowerCase());

    const matchesFilter = userFilter === 'all' || user.status === userFilter;

    return matchesSearch && matchesFilter;
  });

  const filteredCourses = courses.filter(course => {
    const matchesSearch = !courseSearchTerm ||
      course.name.toLowerCase().includes(courseSearchTerm.toLowerCase()) ||
      course.author.toLowerCase().includes(courseSearchTerm.toLowerCase());

    const matchesFilter = courseFilter === 'all' || course.status === courseFilter;

    return matchesSearch && matchesFilter;
  });

  const handleBulkUserAction = useCallback(async () => {
    if (selectedUsers.length === 0 || !bulkAction || !onBulkUserOperation) {
      return;
    }

    setIsPerformingAction(true);
    try {
      const result = await onBulkUserOperation(bulkAction, selectedUsers);
      setActionResult(result);
      setSelectedUsers([]);
      setBulkAction('');

      // Refresh users data after action
      await mutateUsers();
    } catch (error) {
      console.error('Bulk user action failed:', error);
      setActionResult({
        message: 'Action failed. Please try again.',
        results: {
          success: [],
          failed: selectedUsers.map(id => ({ user_id: id, error: 'Unknown error' }))
        }
      });
    } finally {
      setIsPerformingAction(false);
    }
  }, [selectedUsers, bulkAction, onBulkUserOperation, mutateUsers]);

  const handleBulkCourseAction = useCallback(async () => {
    if (selectedCourses.length === 0 || !courseAction || !onBulkCourseOperation) {
      return;
    }

    setIsPerformingAction(true);
    try {
      const result = await onBulkCourseOperation(courseAction, selectedCourses);
      setActionResult(result);
      setSelectedCourses([]);
      setCourseAction('');

      // Refresh courses data after action
      await mutateCourses();
    } catch (error) {
      console.error('Bulk course action failed:', error);
      setActionResult({
        message: 'Action failed. Please try again.',
        results: {
          success: [],
          failed: selectedCourses.map(id => ({ user_id: id, error: 'Unknown error' }))
        }
      });
    } finally {
      setIsPerformingAction(false);
    }
  }, [selectedCourses, courseAction, onBulkCourseOperation, mutateCourses]);

  const handleSystemExport = useCallback(async (exportType: string) => {
    if (!onSystemAction) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      await onSystemAction('export', { type: exportType });
      setExportProgress(100);

      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 1000);
    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [onSystemAction]);

  const toggleUserSelection = (userId: number) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleCourseSelection = (courseId: number) => {
    setSelectedCourses(prev =>
      prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
      case 'published':
        return 'default';
      case 'inactive':
      case 'draft':
        return 'secondary';
      case 'suspended':
      case 'archived':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'activate':
        return <UserCheck className="h-4 w-4" />;
      case 'deactivate':
        return <UserX className="h-4 w-4" />;
      case 'reset_progress':
        return <RotateCcw className="h-4 w-4" />;
      case 'send_notification':
        return <Mail className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Notice */}
      {(usersError || coursesError) && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Data Loading Error</strong> - There was an issue loading admin data. Please refresh the page or contact support.
          </AlertDescription>
        </Alert>
      )}

      {(!usersData || !coursesData) && !usersError && !coursesError && (
        <Alert className="border-blue-200 bg-blue-50">
          <Clock className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Loading Data</strong> - Fetching the latest user and course information...
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('userManagement')}
          </TabsTrigger>
          <TabsTrigger value="courses" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t('courseManagement')}
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            {t('systemTools')}
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('security')}
          </TabsTrigger>
        </TabsList>

        {/* User Management Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('bulkUserActions')}
              </CardTitle>
              <CardDescription>
                {t('userManagementDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* User Search and Filter */}
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-gray-500" />
                  <Input
                    placeholder={t('searchUsers')}
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <Select value={userFilter} onValueChange={setUserFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder={t('filterUsers')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('allUsers')}</SelectItem>
                      <SelectItem value="active">{t('activeUsers')}</SelectItem>
                      <SelectItem value="inactive">{t('inactiveUsers')}</SelectItem>
                      <SelectItem value="student">{t('students')}</SelectItem>
                      <SelectItem value="instructor">{t('instructors')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Users List */}
              <ScrollArea className="h-96 border rounded-lg">
                <div className="p-4">
                  <div className="space-y-2">
                    {filteredUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedUsers.includes(user.id)}
                            onCheckedChange={() => toggleUserSelection(user.id)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{user.name}</p>
                              <Badge variant={getStatusBadgeVariant(user.status)}>
                                {user.status}
                              </Badge>
                              <Badge variant="outline">{user.role}</Badge>
                            </div>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                              <span>{t('lastActive')}: {user.lastActive}</span>
                              <span>{t('courses')}: {user.coursesEnrolled}</span>
                              <span>{t('completion')}: {user.completionRate}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>

              {/* Bulk Actions */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Select value={bulkAction} onValueChange={setBulkAction}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder={t('selectAction')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activate">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          {t('activateUsers')}
                        </div>
                      </SelectItem>
                      <SelectItem value="deactivate">
                        <div className="flex items-center gap-2">
                          <UserX className="h-4 w-4" />
                          {t('deactivateUsers')}
                        </div>
                      </SelectItem>
                      <SelectItem value="reset_progress">
                        <div className="flex items-center gap-2">
                          <RotateCcw className="h-4 w-4" />
                          {t('resetProgress')}
                        </div>
                      </SelectItem>
                      <SelectItem value="send_notification">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {t('sendNotification')}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={handleBulkUserAction}
                    disabled={!bulkAction || selectedUsers.length === 0 || isPerformingAction}
                    className="flex items-center gap-2"
                  >
                    {isPerformingAction ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      getActionIcon(bulkAction)
                    )}
                    {isPerformingAction ? t('processing') : t('executeAction')}
                  </Button>
                </div>

                {selectedUsers.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {t('selectedUsersCount', { count: selectedUsers.length })}
                    </AlertDescription>
                  </Alert>
                )}

                {actionResult && (
                  <Alert className={actionResult.results.failed.length > 0 ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium">{actionResult.message}</p>
                      <p className="text-sm mt-1">
                        {t('actionResults', {
                          success: actionResult.results.success.length,
                          failed: actionResult.results.failed.length
                        })}
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Course Management Tab */}
        <TabsContent value="courses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {t('bulkCourseActions')}
              </CardTitle>
              <CardDescription>
                {t('courseManagementDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Course Search and Filter */}
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-gray-500" />
                  <Input
                    placeholder={t('searchCourses')}
                    value={courseSearchTerm}
                    onChange={(e) => setCourseSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <Select value={courseFilter} onValueChange={setCourseFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder={t('filterCourses')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('allCourses')}</SelectItem>
                      <SelectItem value="published">{t('published')}</SelectItem>
                      <SelectItem value="draft">{t('draft')}</SelectItem>
                      <SelectItem value="archived">{t('archived')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Courses List */}
              <ScrollArea className="h-96 border rounded-lg">
                <div className="p-4">
                  <div className="space-y-2">
                    {filteredCourses.map((course) => (
                      <div key={course.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedCourses.includes(course.id)}
                            onCheckedChange={() => toggleCourseSelection(course.id)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{course.name}</p>
                              <Badge variant={getStatusBadgeVariant(course.status)}>
                                {course.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">{t('author')}: {course.author}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                              <span>{t('enrollments')}: {course.enrollments}</span>
                              <span>{t('completion')}: {course.completionRate}%</span>
                              <span>{t('lastModified')}: {course.lastModified}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tools Tab */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Data Export/Import */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  {t('dataManagement')}
                </CardTitle>
                <CardDescription>
                  {t('dataManagementDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 justify-start h-auto p-4"
                    onClick={() => handleSystemExport('users')}
                    disabled={isExporting}
                  >
                    <Download className="h-5 w-5" />
                    <div className="text-left">
                      <p className="font-medium">{t('exportUsers')}</p>
                      <p className="text-sm text-gray-500">{t('exportUsersDescription')}</p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="flex items-center gap-2 justify-start h-auto p-4"
                    onClick={() => handleSystemExport('courses')}
                    disabled={isExporting}
                  >
                    <Download className="h-5 w-5" />
                    <div className="text-left">
                      <p className="font-medium">{t('exportCourses')}</p>
                      <p className="text-sm text-gray-500">{t('exportCoursesDescription')}</p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="flex items-center gap-2 justify-start h-auto p-4"
                    disabled={isImporting}
                  >
                    <Upload className="h-5 w-5" />
                    <div className="text-left">
                      <p className="font-medium">{t('importData')}</p>
                      <p className="text-sm text-gray-500">{t('importDataDescription')}</p>
                    </div>
                  </Button>
                </div>

                {isExporting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{t('exportProgress')}</span>
                      <span>{exportProgress}%</span>
                    </div>
                    <Progress value={exportProgress} className="w-full" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Maintenance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {t('systemMaintenance')}
                </CardTitle>
                <CardDescription>
                  {t('systemMaintenanceDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <Button variant="outline" className="flex items-center gap-2 justify-start h-auto p-4">
                    <RefreshCw className="h-5 w-5" />
                    <div className="text-left">
                      <p className="font-medium">{t('clearCache')}</p>
                      <p className="text-sm text-gray-500">{t('clearCacheDescription')}</p>
                    </div>
                  </Button>

                  <Button variant="outline" className="flex items-center gap-2 justify-start h-auto p-4">
                    <Trash2 className="h-5 w-5" />
                    <div className="text-left">
                      <p className="font-medium">{t('cleanupTempFiles')}</p>
                      <p className="text-sm text-gray-500">{t('cleanupDescription')}</p>
                    </div>
                  </Button>

                  <Button variant="outline" className="flex items-center gap-2 justify-start h-auto p-4">
                    <BarChart3 className="h-5 w-5" />
                    <div className="text-left">
                      <p className="font-medium">{t('generateReports')}</p>
                      <p className="text-sm text-gray-500">{t('reportsDescription')}</p>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Management Tab */}
        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Access Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  {t('accessManagement')}
                </CardTitle>
                <CardDescription>
                  {t('accessManagementDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <Button variant="outline" className="flex items-center gap-2 justify-start h-auto p-4">
                    <Shield className="h-5 w-5" />
                    <div className="text-left">
                      <p className="font-medium">{t('managePermissions')}</p>
                      <p className="text-sm text-gray-500">{t('permissionsDescription')}</p>
                    </div>
                  </Button>

                  <Button variant="outline" className="flex items-center gap-2 justify-start h-auto p-4">
                    <Eye className="h-5 w-5" />
                    <div className="text-left">
                      <p className="font-medium">{t('auditLogs')}</p>
                      <p className="text-sm text-gray-500">{t('auditDescription')}</p>
                    </div>
                  </Button>

                  <Button variant="outline" className="flex items-center gap-2 justify-start h-auto p-4">
                    <Monitor className="h-5 w-5" />
                    <div className="text-left">
                      <p className="font-medium">{t('sessionManagement')}</p>
                      <p className="text-sm text-gray-500">{t('sessionDescription')}</p>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Security Monitoring */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t('securityMonitoring')}
                </CardTitle>
                <CardDescription>
                  {t('securityMonitoringDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">{t('passwordPolicy')}</span>
                    </div>
                    <Badge variant="outline" className="text-green-600">
                      {t('enabled')}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">{t('twoFactorAuth')}</span>
                    </div>
                    <Badge variant="outline" className="text-green-600">
                      {t('enabled')}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">{t('loginAttempts')}</span>
                    </div>
                    <Badge variant="outline" className="text-orange-600">
                      {t('monitoring')}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminActionsDashboard;
