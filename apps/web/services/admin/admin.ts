import { RequestBodyWithAuthHeader, getResponseMetadata } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';

export interface AdminOverviewMetrics {
  totalUsers: number;
  totalCourses: number;
  totalActivities: number;
  activeUsers30Days: number;
  coursesCompletedThisMonth: number;
  newUsersThisMonth: number;
  platformUsageGrowth: number;
  avgSessionDuration: number | null;
  topCourses: {
    id: string;
    name: string;
    enrollments: number;
    completion_rate: number;
  }[];
  recentActivity: {
    description: string;
    timestamp: string;
    type: string;
  }[];
}

export interface AdminAnalyticsMetrics {
  userEngagement: {
    dailyActiveUsers: number;
    avgSessionDuration: number | null;
    returnRate: number;
  };
  contentPerformance: {
    popularCourses: {
      name: string;
      views: number;
    }[];
    overallCompletion: number;
    avgRating: number | null;
  };
  learningProgress: {
    coursesStarted: number;
    coursesCompleted: number;
    totalCertificates: number;
    avgProgressRate: number;
  };
  platformUsage: {
    peakHours: { hour: number; users: number }[];
    deviceTypes: { type: string; percentage: number }[];
  };
}

export interface AdminGamificationMetrics {
  totalProfiles: number;
  activeGamifiedUsers: number;
  engagementRate: number;
  levelDistribution: {
    level: number;
    users: number;
  }[];
  xpStatistics: {
    averageXP: number;
    maxXP: number;
  };
  streakStatistics: {
    averageLoginStreak: number;
    maxLoginStreak: number;
  };
  xpDistribution: {
    label: string;
    users: number;
    percentage: number;
  }[];
}

export interface AdminRetentionMetrics {
  cohorts: {
    cohortMonth: string;
    newUsers: number;
    retentionData: {
      month: number;
      activeUsers: number;
      retentionRate: number;
    }[];
  }[];
  overallMetrics: {
    totalNewUsers: number;
    avg30DayRetention: number;
    churnRate: number;
  };
}

export interface AdminRealtimeMetrics {
  liveUsers: {
    count: number;
    trend: string;
  };
  activeSessions: {
    courseName: string;
    activeSessions: number;
  }[];
  activityFeed: {
    type: string;
    description: string;
    timestamp: string;
    userId: number;
  }[];
  lastUpdated: string;
}

export interface AdminAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  timestamp: string;
  actionRequired: boolean;
}

export interface AdminAlertsResponse {
  alerts: AdminAlert[];
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface CourseFunnel {
  courseId: number;
  courseName: string;
  stages: {
    name: string;
    users: number;
    percentage: number;
    dropoffRate: number;
  }[];
}

export interface AdminCourseFunnelsMetrics {
  funnels: CourseFunnel[];
  summary: {
    totalCourses: number;
    avgCompletionRate: number;
  };
}

export interface BulkOperationResult {
  message: string;
  results: {
    success: number[];
    failed: { user_id: number; error: string }[];
  };
}

export async function getAdminOverviewMetrics(orgId: number, accessToken: string): Promise<AdminOverviewMetrics> {
  try {
    const result = await fetch(
      `${getAPIUrl()}admin/metrics/overview?org_id=${orgId}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error fetching admin overview metrics:', error);
    throw error; // Re-throw the error instead of returning mock data
  }
}

export async function getAdminAnalyticsMetrics(orgId: number, accessToken: string): Promise<AdminAnalyticsMetrics> {
  try {
    const result = await fetch(
      `${getAPIUrl()}admin/metrics/analytics?org_id=${orgId}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error fetching admin analytics metrics:', error);
    throw error; // Re-throw the error instead of returning mock data
  }
}

export async function getAdminGamificationMetrics(
  orgId: number,
  accessToken: string,
): Promise<AdminGamificationMetrics> {
  try {
    const result = await fetch(
      `${getAPIUrl()}admin/metrics/gamification?org_id=${orgId}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error fetching admin gamification metrics:', error);
    throw error; // Re-throw the error instead of returning mock data
  }
}

export async function getAdminRetentionMetrics(orgId: number, accessToken: string): Promise<AdminRetentionMetrics> {
  try {
    const result = await fetch(
      `${getAPIUrl()}admin/metrics/retention?org_id=${orgId}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error fetching admin retention metrics:', error);
    throw error;
  }
}

export async function getAdminRealtimeMetrics(orgId: number, accessToken: string): Promise<AdminRealtimeMetrics> {
  try {
    const result = await fetch(
      `${getAPIUrl()}admin/metrics/realtime?org_id=${orgId}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error fetching admin realtime metrics:', error);
    throw error;
  }
}

export async function getAdminAlerts(orgId: number, accessToken: string): Promise<AdminAlertsResponse> {
  try {
    const result = await fetch(
      `${getAPIUrl()}admin/alerts?org_id=${orgId}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error fetching admin alerts:', error);
    throw error;
  }
}

export async function getCourseFunnelMetrics(
  orgId: number,
  accessToken: string,
  courseId?: number,
): Promise<AdminCourseFunnelsMetrics> {
  try {
    const url = courseId
      ? `${getAPIUrl()}admin/metrics/course-funnels?org_id=${orgId}&course_id=${courseId}`
      : `${getAPIUrl()}admin/metrics/course-funnels?org_id=${orgId}`;

    const result = await fetch(url, RequestBodyWithAuthHeader('GET', null, null, accessToken));

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error fetching course funnel metrics:', error);
    throw error;
  }
}

export async function performBulkUserOperation(
  orgId: number,
  accessToken: string,
  action: string,
  userIds: number[],
): Promise<BulkOperationResult> {
  try {
    const result = await fetch(
      `${getAPIUrl()}admin/actions/bulk-user-operation?org_id=${orgId}`,
      RequestBodyWithAuthHeader('POST', { action, user_ids: userIds }, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error performing bulk user operation:', error);
    throw error;
  }
}

// Additional Admin Service Functions

export interface SystemActionResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface UserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'suspended';
  lastActive: string;
  joinDate: string;
  coursesEnrolled: number;
  completionRate: number;
}

export interface CourseListResponse {
  courses: AdminCourse[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminCourse {
  id: number;
  name: string;
  status: 'published' | 'draft' | 'archived';
  enrollments: number;
  completionRate: number;
  lastModified: string;
  author: string;
}

export async function getAdminUsers(
  orgId: number,
  accessToken: string,
  page = 1,
  limit = 20,
  search?: string,
  filter?: string,
): Promise<UserListResponse> {
  try {
    const params = new URLSearchParams({
      org_id: orgId.toString(),
      page: page.toString(),
      limit: limit.toString(),
    });

    if (search) params.append('search', search);
    if (filter) params.append('filter', filter);

    const result = await fetch(
      `${getAPIUrl()}admin/users?${params}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error fetching admin users:', error);
    throw error;
  }
}

export async function getAdminCourses(
  orgId: number,
  accessToken: string,
  page = 1,
  limit = 20,
  search?: string,
  filter?: string,
): Promise<CourseListResponse> {
  try {
    const params = new URLSearchParams({
      org_id: orgId.toString(),
      page: page.toString(),
      limit: limit.toString(),
    });

    if (search) params.append('search', search);
    if (filter) params.append('filter', filter);

    const result = await fetch(
      `${getAPIUrl()}admin/courses?${params}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error fetching admin courses:', error);
    throw error;
  }
}

export async function performSystemAction(
  orgId: number,
  accessToken: string,
  action: string,
  data?: any,
): Promise<SystemActionResult> {
  try {
    const result = await fetch(
      `${getAPIUrl()}admin/system/action?org_id=${orgId}`,
      RequestBodyWithAuthHeader('POST', { action, data }, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error performing system action:', error);
    throw error;
  }
}

export async function exportSystemData(
  orgId: number,
  accessToken: string,
  exportType: 'users' | 'courses' | 'analytics' | 'all',
): Promise<Blob> {
  try {
    const result = await fetch(
      `${getAPIUrl()}admin/export?org_id=${orgId}&type=${exportType}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    return await result.blob();
  } catch (error) {
    console.error('Error exporting system data:', error);
    throw error;
  }
}

export async function importSystemData(
  orgId: number,
  accessToken: string,
  file: File,
  importType: 'users' | 'courses' | 'all',
): Promise<SystemActionResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', importType);

    const result = await fetch(`${getAPIUrl()}admin/import?org_id=${orgId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error importing system data:', error);
    throw error;
  }
}

export async function performBulkCourseOperation(
  orgId: number,
  accessToken: string,
  action: string,
  courseIds: number[],
): Promise<BulkOperationResult> {
  try {
    const result = await fetch(
      `${getAPIUrl()}admin/actions/bulk-course-operation?org_id=${orgId}`,
      RequestBodyWithAuthHeader('POST', { action, course_ids: courseIds }, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error performing bulk course operation:', error);
    throw error;
  }
}

export async function getSecuritySettings(orgId: number, accessToken: string): Promise<any> {
  try {
    const result = await fetch(
      `${getAPIUrl()}admin/security/settings?org_id=${orgId}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error fetching security settings:', error);
    throw error;
  }
}

export async function updateSecuritySettings(
  orgId: number,
  accessToken: string,
  settings: any,
): Promise<SystemActionResult> {
  try {
    const result = await fetch(
      `${getAPIUrl()}admin/security/settings?org_id=${orgId}`,
      RequestBodyWithAuthHeader('PUT', settings, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error updating security settings:', error);
    throw error;
  }
}

export async function getAdminDashboard(orgId: number, accessToken: string, timeRange?: string) {
  try {
    const params = new URLSearchParams();
    params.append('org_id', orgId.toString());
    if (timeRange) params.append('timeRange', timeRange);

    const result = await fetch(
      `${getAPIUrl()}admin/dashboard?${params.toString()}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error getting admin dashboard:', error);
    throw error;
  }
}

export async function getAdminOverviewAlerts(orgId: number, accessToken: string, severity?: string) {
  try {
    const params = new URLSearchParams();
    params.append('org_id', orgId.toString());
    if (severity) params.append('severity', severity);

    const result = await fetch(
      `${getAPIUrl()}admin/alerts?${params.toString()}`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken),
    );

    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const response = await getResponseMetadata(result);
    return response.data;
  } catch (error) {
    console.error('Error getting admin alerts:', error);
    throw error;
  }
}
