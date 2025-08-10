'use client';

import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Download,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  Upload,
  Users,
  XCircle,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import type { AdminAlertsResponse, BulkOperationResult } from '@services/admin/admin';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { Alert, AlertDescription } from '@components/ui/alert';
import { useFormatter, useTranslations } from 'next-intl';
import { ScrollArea } from '@components/ui/scroll-area';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { useState } from 'react';

interface AdminAlertsAndActionsProps {
  alerts: AdminAlertsResponse;
  isLoading?: boolean;
  onRefreshAlerts?: () => void;
  onBulkAction?: (action: string, userIds: number[]) => Promise<BulkOperationResult>;
}

export const AdminAlertsAndActions = ({
  alerts,
  isLoading = false,
  onRefreshAlerts,
  onBulkAction,
}: AdminAlertsAndActionsProps) => {
  const t = useTranslations('DashPage.Admin.Alerts');
  const format = useFormatter();
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [isPerformingAction, setIsPerformingAction] = useState(false);
  const [actionResult, setActionResult] = useState<BulkOperationResult | null>(null);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': {
        return 'border-red-200 bg-red-50 text-red-800';
      }
      case 'medium': {
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      }
      case 'low': {
        return 'border-blue-200 bg-blue-50 text-blue-800';
      }
      default: {
        return 'border-gray-200 bg-gray-50 text-gray-800';
      }
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': {
        return <XCircle className="h-5 w-5 text-red-600" />;
      }
      case 'medium': {
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      }
      case 'low': {
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
      }
      default: {
        return <Bell className="h-5 w-5 text-gray-600" />;
      }
    }
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'user_engagement': {
        return <Users className="h-4 w-4" />;
      }
      case 'course_performance': {
        return <AlertTriangle className="h-4 w-4" />;
      }
      case 'system': {
        return <Settings className="h-4 w-4" />;
      }
      case 'security': {
        return <Shield className="h-4 w-4" />;
      }
      default: {
        return <Bell className="h-4 w-4" />;
      }
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return format.dateTime(date, {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch (error) {
      console.warn('Invalid timestamp format in formatTimestamp:', timestamp, error);
      return timestamp;
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedUsers.length === 0 || !onBulkAction) return;

    setIsPerformingAction(true);
    try {
      const result = await onBulkAction(bulkAction, selectedUsers);
      setActionResult(result);
      setSelectedUsers([]);
      setBulkAction('');
    } catch (error) {
      console.error('Bulk action failed:', error);
    } finally {
      setIsPerformingAction(false);
    }
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const selectAllUsers = () => {
    // TODO: complete backend integration
    setSelectedUsers([]);
  };

  return (
    <div className="space-y-6">
      {/* Alerts Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('totalAlerts')}</p>
                <p className="text-2xl font-bold">{alerts.summary.total}</p>
              </div>
              <Bell className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('highPriority')}</p>
                <p className="text-2xl font-bold text-red-600">{alerts.summary.high}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('mediumPriority')}</p>
                <p className="text-2xl font-bold text-yellow-600">{alerts.summary.medium}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('lowPriority')}</p>
                <p className="text-2xl font-bold text-blue-600">{alerts.summary.low}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs
        defaultValue="alerts"
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <TabsList className="grid w-fit grid-cols-2">
            <TabsTrigger value="alerts">{t('systemAlerts')}</TabsTrigger>
            <TabsTrigger value="actions">{t('bulkActions')}</TabsTrigger>
          </TabsList>

          <Button
            onClick={onRefreshAlerts}
            disabled={isLoading}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </div>

        <TabsContent
          value="alerts"
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                {t('activeAlerts')}
              </CardTitle>
              <CardDescription>{t('alertsDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-auto">
                {alerts.alerts.length > 0 ? (
                  <div className="space-y-4">
                    {alerts.alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`rounded-lg border p-4 ${getSeverityColor(alert.severity)}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1">{getSeverityIcon(alert.severity)}</div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex items-center gap-2">
                              <h4 className="font-semibold">{alert.title}</h4>
                              <Badge
                                variant="outline"
                                className="text-xs"
                              >
                                {getAlertTypeIcon(alert.type)}
                                <span className="ml-1">{alert.type}</span>
                              </Badge>
                              <Badge variant={alert.severity === 'high' ? 'destructive' : 'secondary'}>
                                {alert.severity}
                              </Badge>
                            </div>
                            <p className="mb-2 text-sm">{alert.description}</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(alert.timestamp)}
                              </div>
                              {alert.actionRequired && (
                                <Badge
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {t('actionRequired')}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-600" />
                    <p className="text-gray-600">{t('noActiveAlerts')}</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="actions"
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t('bulkUserActions')}
              </CardTitle>
              <CardDescription>{t('bulkActionsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* User Selection */}
              <div>
                <h4 className="mb-3 font-medium">{t('selectUsers')}</h4>
                <div className="mb-4 flex items-center gap-4">
                  <Button
                    onClick={selectAllUsers}
                    size="sm"
                    variant="outline"
                  >
                    {t('selectAll')}
                  </Button>
                  <Button
                    onClick={() => setSelectedUsers([])}
                    size="sm"
                    variant="outline"
                  >
                    {t('clearSelection')}
                  </Button>
                  <span className="text-sm text-gray-600">
                    {selectedUsers.length} {t('usersSelected')}
                  </span>
                </div>

                {/* User list - TODO: needs to be connected to API */}
                <div className="max-h-48 overflow-y-auto rounded-lg border">
                  <div className="py-8 text-center text-gray-500">
                    <Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p>{t('userListNotAvailable')}</p>
                    <p className="mt-1 text-xs">{t('connectUserManagementAPI')}</p>
                  </div>
                </div>
              </div>

              {/* Action Selection */}
              <div>
                <h4 className="mb-3 font-medium">{t('selectAction')}</h4>
                <Select
                  value={bulkAction}
                  onValueChange={setBulkAction}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('chooseAction')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activate">{t('activateUsers')}</SelectItem>
                    <SelectItem value="deactivate">{t('deactivateUsers')}</SelectItem>
                    <SelectItem value="reset_progress">{t('resetProgress')}</SelectItem>
                    <SelectItem value="send_notification">{t('sendNotification')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action Execution */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleBulkAction}
                  disabled={!bulkAction || selectedUsers.length === 0 || isPerformingAction}
                  className="flex items-center gap-2"
                >
                  {isPerformingAction ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4" />
                  )}
                  {t('executeAction')}
                </Button>

                {selectedUsers.length > 0 && bulkAction && (
                  <p className="text-sm text-gray-600">
                    {t('willAffect')} {selectedUsers.length} {t('users')}
                  </p>
                )}
              </div>

              {/* Action Result */}
              {actionResult && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div>
                      <p className="font-medium">{actionResult.message}</p>
                      <p className="mt-1 text-sm">
                        {t('successful')}: {actionResult.results.success.length},{t('failed')}:{' '}
                        {actionResult.results.failed.length}
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* System Management Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('systemManagement')}
              </CardTitle>
              <CardDescription>{t('systemManagementDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Button
                  variant="outline"
                  className="flex h-auto items-center gap-2 p-4"
                >
                  <Download className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">{t('exportData')}</p>
                    <p className="text-sm text-gray-500">{t('exportDescription')}</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="flex h-auto items-center gap-2 p-4"
                >
                  <Upload className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">{t('importData')}</p>
                    <p className="text-sm text-gray-500">{t('importDescription')}</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="flex h-auto items-center gap-2 p-4"
                >
                  <Trash2 className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">{t('cleanupData')}</p>
                    <p className="text-sm text-gray-500">{t('cleanupDescription')}</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="flex h-auto items-center gap-2 p-4"
                >
                  <RefreshCw className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">{t('refreshCache')}</p>
                    <p className="text-sm text-gray-500">{t('cacheDescription')}</p>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAlertsAndActions;
