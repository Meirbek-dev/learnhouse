'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@components/ui/dialog';
import { Checkbox } from '@components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Alert, AlertDescription } from '@components/ui/alert';
import { ScrollArea } from '@components/ui/scroll-area';
import {
  AlertTriangle,
  Bell,
  Users,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  Trash2,
  RefreshCw,
  Download,
  Upload
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { AdminAlert, AdminAlertsResponse, BulkOperationResult } from '@services/admin/admin';

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
  onBulkAction
}: AdminAlertsAndActionsProps) => {
  const t = useTranslations('DashPage.Admin.Alerts');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [isPerformingAction, setIsPerformingAction] = useState(false);
  const [actionResult, setActionResult] = useState<BulkOperationResult | null>(null);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'medium':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      case 'low':
        return 'border-blue-200 bg-blue-50 text-blue-800';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'medium':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'low':
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-600" />;
    }
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'user_engagement':
        return <Users className="h-4 w-4" />;
      case 'course_performance':
        return <AlertTriangle className="h-4 w-4" />;
      case 'system':
        return <Settings className="h-4 w-4" />;
      case 'security':
        return <Shield className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
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
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    // Note: No user data available for selection until backend integration is complete
    setSelectedUsers([]);
  };

  return (
    <div className="space-y-6">
      {/* Alerts Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      <Tabs defaultValue="alerts" className="space-y-4">
        <div className="flex justify-between items-center">
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
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </div>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                {t('activeAlerts')}
              </CardTitle>
              <CardDescription>
                {t('alertsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {alerts.alerts.length > 0 ? (
                  <div className="space-y-4">
                    {alerts.alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 border rounded-lg ${getSeverityColor(alert.severity)}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {getSeverityIcon(alert.severity)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">{alert.title}</h4>
                              <Badge variant="outline" className="text-xs">
                                {getAlertTypeIcon(alert.type)}
                                <span className="ml-1">{alert.type}</span>
                              </Badge>
                              <Badge variant={alert.severity === 'high' ? 'destructive' : 'secondary'}>
                                {alert.severity}
                              </Badge>
                            </div>
                            <p className="text-sm mb-2">{alert.description}</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(alert.timestamp)}
                              </div>
                              {alert.actionRequired && (
                                <Badge variant="outline" className="text-xs">
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
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                    <p className="text-gray-600">{t('noActiveAlerts')}</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t('bulkUserActions')}
              </CardTitle>
              <CardDescription>
                {t('bulkActionsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* User Selection */}
              <div>
                <h4 className="font-medium mb-3">{t('selectUsers')}</h4>
                <div className="flex items-center gap-4 mb-4">
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

                {/* User list - needs to be connected to actual API */}
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>{t('userListNotAvailable')}</p>
                    <p className="text-xs mt-1">{t('connectUserManagementAPI')}</p>
                  </div>
                </div>
              </div>

              {/* Action Selection */}
              <div>
                <h4 className="font-medium mb-3">{t('selectAction')}</h4>
                <Select value={bulkAction} onValueChange={setBulkAction}>
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
                      <p className="text-sm mt-1">
                        {t('successful')}: {actionResult.results.success.length},
                        {t('failed')}: {actionResult.results.failed.length}
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
              <CardDescription>
                {t('systemManagementDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="flex items-center gap-2 h-auto p-4">
                  <Download className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">{t('exportData')}</p>
                    <p className="text-sm text-gray-500">{t('exportDescription')}</p>
                  </div>
                </Button>

                <Button variant="outline" className="flex items-center gap-2 h-auto p-4">
                  <Upload className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">{t('importData')}</p>
                    <p className="text-sm text-gray-500">{t('importDescription')}</p>
                  </div>
                </Button>

                <Button variant="outline" className="flex items-center gap-2 h-auto p-4">
                  <Trash2 className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">{t('cleanupData')}</p>
                    <p className="text-sm text-gray-500">{t('cleanupDescription')}</p>
                  </div>
                </Button>

                <Button variant="outline" className="flex items-center gap-2 h-auto p-4">
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
