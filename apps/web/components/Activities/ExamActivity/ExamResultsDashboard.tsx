'use client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Download, Eye, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface AttemptData {
  attempt_uuid: string;
  user_id: number;
  user_name: string;
  user_email: string;
  started_at: string;
  finished_at: string | null;
  duration_minutes: number | null;
  status: string;
  score: number;
  max_score: number;
  percentage: number;
  violations: any[];
  violation_count: number;
}

interface ExamResultsDashboardProps {
  examUuid: string;
  attempts: AttemptData[];
  onViewAttempt: (attemptUuid: string) => void;
}

export default function ExamResultsDashboard({ examUuid, attempts, onViewAttempt }: ExamResultsDashboardProps) {
  const t = useTranslations('Components.ExamResultsDashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('started_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Calculate statistics
  const stats = useMemo(() => {
    const submitted = attempts.filter((a) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED');
    const scores = submitted.map((a) => a.percentage);

    return {
      totalStudents: new Set(attempts.map((a) => a.user_id)).size,
      totalAttempts: attempts.length,
      submitted: submitted.length,
      inProgress: attempts.filter((a) => a.status === 'IN_PROGRESS').length,
      avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      avgTime:
        submitted.length > 0
          ? Math.round(
              submitted.filter((a) => a.duration_minutes !== null).reduce((a, b) => a + (b.duration_minutes || 0), 0) /
                submitted.length,
            )
          : 0,
    };
  }, [attempts]);

  // Filter and sort attempts
  const filteredAttempts = useMemo(() => {
    let filtered = [...attempts];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) => a.user_name.toLowerCase().includes(query) || a.user_email.toLowerCase().includes(query),
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((a) => a.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[sortBy as keyof AttemptData];
      let bVal: any = b[sortBy as keyof AttemptData];

      if (aVal === null) aVal = sortOrder === 'asc' ? Infinity : -Infinity;
      if (bVal === null) bVal = sortOrder === 'asc' ? Infinity : -Infinity;

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }, [attempts, searchQuery, statusFilter, sortBy, sortOrder]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return t('submitted');
      case 'AUTO_SUBMITTED':
        return t('autoSubmitted');
      case 'IN_PROGRESS':
        return t('inProgress');
      default:
        return status;
    }
  };

  const handleExportCSV = () => {
    const headers = [
      t('exportHeaders.studentName'),
      t('exportHeaders.email'),
      t('exportHeaders.startedAt'),
      t('exportHeaders.finishedAt'),
      t('exportHeaders.durationMinutes'),
      t('exportHeaders.status'),
      t('exportHeaders.score'),
      t('exportHeaders.percentage'),
      t('exportHeaders.violations'),
    ];

    const rows = filteredAttempts.map((a) => [
      a.user_name,
      a.user_email,
      a.started_at,
      a.finished_at || '',
      a.duration_minutes?.toString() || '',
      getStatusLabel(a.status),
      `${a.score}/${a.max_score}`,
      `${a.percentage}%`,
      a.violation_count.toString(),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `exam-results-${examUuid}-${new Date().toISOString()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED': {
        return <Badge variant="default">{t('submitted')}</Badge>;
      }
      case 'AUTO_SUBMITTED': {
        return <Badge variant="destructive">{t('autoSubmitted')}</Badge>;
      }
      case 'IN_PROGRESS': {
        return <Badge variant="secondary">{t('inProgress')}</Badge>;
      }
      default: {
        return <Badge variant="outline">{status}</Badge>;
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalStudents')}</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
            <p className="text-muted-foreground text-xs">
              {t('totalAttempts')}: {stats.totalAttempts}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('averageScore')}</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgScore}%</div>
            <p className="text-muted-foreground text-xs">
              {t('range')}: {stats.lowestScore}% - {stats.highestScore}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('averageTime')}</CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgTime} {t('minutes')}
            </div>
            <p className="text-muted-foreground text-xs">
              {t('submitted')}: {stats.submitted}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('completionRate')}</CardTitle>
            <TrendingDown className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round((stats.submitted / stats.totalAttempts) * 100) || 0}%</div>
            <p className="text-muted-foreground text-xs">
              {t('inProgress')}: {stats.inProgress}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('allAttempts')}</CardTitle>
              <CardDescription>{t('allAttemptsDescription')}</CardDescription>
            </div>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
            >
              <Download className="mr-2 h-4 w-4" />
              {t('exportCSV')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Input
              placeholder={t('searchStudents')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('filterByStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatuses')}</SelectItem>
                <SelectItem value="SUBMITTED">{t('submitted')}</SelectItem>
                <SelectItem value="AUTO_SUBMITTED">{t('autoSubmitted')}</SelectItem>
                <SelectItem value="IN_PROGRESS">{t('inProgress')}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sortBy}
              onValueChange={setSortBy}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('sortBy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="started_at">{t('startedAt')}</SelectItem>
                <SelectItem value="user_name">{t('studentName')}</SelectItem>
                <SelectItem value="percentage">{t('score')}</SelectItem>
                <SelectItem value="duration_minutes">{t('duration')}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('student')}</TableHead>
                  <TableHead>{t('startedAt')}</TableHead>
                  <TableHead>{t('duration')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('score')}</TableHead>
                  <TableHead>{t('violations')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttempts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground text-center"
                    >
                      {t('noAttempts')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAttempts.map((attempt) => (
                    <TableRow key={attempt.attempt_uuid}>
                      <TableCell>
                        <div className="font-medium">{attempt.user_name}</div>
                        <div className="text-muted-foreground text-sm">{attempt.user_email}</div>
                      </TableCell>
                      <TableCell>{new Date(attempt.started_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {attempt.duration_minutes !== null ? `${attempt.duration_minutes} ${t('minutes')}` : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(attempt.status)}</TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {attempt.score}/{attempt.max_score}
                        </div>
                        <div className="text-muted-foreground text-sm">{attempt.percentage}%</div>
                      </TableCell>
                      <TableCell>
                        {attempt.violation_count > 0 ? (
                          <Badge variant="destructive">{attempt.violation_count}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewAttempt(attempt.attempt_uuid)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          {t('view')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
