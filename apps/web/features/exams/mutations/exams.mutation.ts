'use client';

import { apiFetch } from '@/lib/api-client';
import { mutationOptions, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';

async function updateExamSettingsRequest(examUuid: string, settings: Record<string, unknown>) {
  const response = await apiFetch(`exams/${examUuid}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to update exam settings');
  }

  return response.json();
}

export function updateExamSettingsMutationOptions(examUuid: string, queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: (settings: Record<string, unknown>) => updateExamSettingsRequest(examUuid, settings),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.exams.detail(examUuid) });
    },
  });
}
