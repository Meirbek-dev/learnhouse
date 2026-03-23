'use client';

import {
  bulkAddContributors,
  bulkRemoveContributors,
  editContributor,
  updateCourseAccess,
  updateCourseMetadata,
  updateCourseThumbnail,
} from '@services/courses/courses';
import type { CourseEditorBundle } from '@services/courses/editor';
import { useCourseEditorStore } from '@/stores/courses';
import { courseKeys } from '@/hooks/courses/courseKeys';
import { useSWRConfig } from 'swr';

interface MutationOptions {
  accessToken: string;
  lastKnownUpdateDate?: string | null;
}

interface ContributorDraftUser {
  id: number;
  username: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email?: string;
  avatar_image?: string;
  user_uuid?: string;
}

interface ContributorMutationPayload {
  authorship?: string;
  authorship_status?: string;
}

const ensureMutationSuccess = (response: any) => {
  if (response?.success) {
    return response;
  }

  const error: any = new Error(response?.data?.detail || response?.HTTPmessage || 'Request failed');
  error.status = response?.status ?? 500;
  error.detail = response?.data?.detail;
  error.data = response?.data;
  throw error;
};

const buildOptimisticContributor = (user: ContributorDraftUser) => {
  const now = new Date().toISOString();

  return {
    id: `temp-${user.user_uuid ?? user.id}`,
    user_id: user.id,
    authorship: 'CONTRIBUTOR',
    authorship_status: 'PENDING',
    creation_date: now,
    update_date: now,
    user: {
      username: user.username,
      first_name: user.first_name ?? '',
      middle_name: user.middle_name ?? '',
      last_name: user.last_name ?? '',
      email: user.email ?? '',
      avatar_image: user.avatar_image ?? '',
      user_uuid: user.user_uuid ?? '',
    },
  };
};

export function useCoursesMutations(courseUuid: string, withUnpublishedActivities = true) {
  const { mutate } = useSWRConfig();
  const structureKey = courseKeys.structure(courseUuid, withUnpublishedActivities);
  const detailKey = courseKeys.detail(courseUuid);

  const captureCurrentValue = async <T,>(key: string | readonly unknown[]) => {
    let snapshot: T | undefined;

    await mutate(
      key,
      (current: T | undefined) => {
        snapshot = current;
        return current;
      },
      { revalidate: false },
    );

    return snapshot;
  };

  const refreshCourse = async () => {
    await Promise.all([mutate(structureKey), mutate(detailKey)]);
  };

  const refreshEditorBundle = async (accessToken: string) => {
    const editorBundleKey = courseKeys.editorBundle(courseUuid, accessToken);
    if (!editorBundleKey) {
      return;
    }

    await mutate(editorBundleKey);
  };

  const updateMetadata = async (payload: any, options: MutationOptions) => {
    const previousStructure = await mutate(structureKey);

    await mutate(
      structureKey,
      (current: any) =>
        current
          ? {
              ...current,
              ...payload,
            }
          : current,
      { revalidate: false },
    );

    try {
      const response = ensureMutationSuccess(
        await updateCourseMetadata(courseUuid, payload, options.accessToken, {
          lastKnownUpdateDate: options.lastKnownUpdateDate,
        }),
      );
      useCourseEditorStore.getState().syncLastKnownUpdateDate(response?.data?.update_date);
      await refreshCourse();
      return response;
    } catch (error) {
      await mutate(structureKey, previousStructure, { revalidate: false });
      throw error;
    }
  };

  const updateAccess = async (payload: any, options: MutationOptions) => {
    const previousStructure = await mutate(structureKey);

    await mutate(
      structureKey,
      (current: any) =>
        current
          ? {
              ...current,
              ...payload,
            }
          : current,
      { revalidate: false },
    );

    try {
      const response = ensureMutationSuccess(
        await updateCourseAccess(courseUuid, payload, options.accessToken, {
          lastKnownUpdateDate: options.lastKnownUpdateDate,
        }),
      );
      useCourseEditorStore.getState().syncLastKnownUpdateDate(response?.data?.update_date);
      await refreshCourse();
      return response;
    } catch (error) {
      await mutate(structureKey, previousStructure, { revalidate: false });
      throw error;
    }
  };

  const updateThumbnail = async (formData: FormData, options: MutationOptions) => {
    const response = ensureMutationSuccess(
      await updateCourseThumbnail(courseUuid, formData, options.accessToken, {
        lastKnownUpdateDate: options.lastKnownUpdateDate,
      }),
    );
    useCourseEditorStore.getState().syncLastKnownUpdateDate(response?.data?.update_date);
    await refreshCourse();
    return response;
  };

  const addContributors = async (usernames: string[], users: ContributorDraftUser[], options: MutationOptions) => {
    const editorBundleKey = courseKeys.editorBundle(courseUuid, options.accessToken);
    const previousEditorBundle = editorBundleKey
      ? await captureCurrentValue<CourseEditorBundle>(editorBundleKey)
      : undefined;

    if (editorBundleKey && users.length > 0) {
      await mutate(
        editorBundleKey,
        (current: CourseEditorBundle | undefined) => {
          if (!current) {
            return current;
          }

          const existingContributors = current.contributors.data ?? [];
          const existingUsernames = new Set(existingContributors.map((contributor: any) => contributor.user?.username));
          const optimisticContributors = users
            .filter((user) => !existingUsernames.has(user.username))
            .map((user) => buildOptimisticContributor(user));

          return {
            ...current,
            contributors: {
              ...current.contributors,
              data: [...existingContributors, ...optimisticContributors],
              error: null,
              available: true,
            },
          };
        },
        { revalidate: false },
      );
    }

    try {
      const response = ensureMutationSuccess(await bulkAddContributors(courseUuid, usernames, options.accessToken));
      await Promise.all([refreshCourse(), refreshEditorBundle(options.accessToken)]);
      return response;
    } catch (error) {
      if (editorBundleKey) {
        await mutate(editorBundleKey, previousEditorBundle, { revalidate: false });
      }
      throw error;
    }
  };

  const updateContributor = async (
    contributorUserId: number,
    payload: ContributorMutationPayload,
    options: MutationOptions,
  ) => {
    const editorBundleKey = courseKeys.editorBundle(courseUuid, options.accessToken);
    const previousEditorBundle = editorBundleKey
      ? await captureCurrentValue<CourseEditorBundle>(editorBundleKey)
      : undefined;

    if (editorBundleKey) {
      await mutate(
        editorBundleKey,
        (current: CourseEditorBundle | undefined) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            contributors: {
              ...current.contributors,
              data: (current.contributors.data ?? []).map((contributor: any) =>
                contributor.user_id === contributorUserId
                  ? {
                      ...contributor,
                      ...payload,
                    }
                  : contributor,
              ),
            },
          };
        },
        { revalidate: false },
      );
    }

    try {
      const nextAuthorship = payload.authorship;
      const nextStatus = payload.authorship_status;
      const response = ensureMutationSuccess(
        await editContributor(courseUuid, contributorUserId, nextAuthorship, nextStatus, options.accessToken),
      );
      await Promise.all([refreshCourse(), refreshEditorBundle(options.accessToken)]);
      return response;
    } catch (error) {
      if (editorBundleKey) {
        await mutate(editorBundleKey, previousEditorBundle, { revalidate: false });
      }
      throw error;
    }
  };

  const removeContributors = async (usernames: string[], userIds: number[], options: MutationOptions) => {
    const editorBundleKey = courseKeys.editorBundle(courseUuid, options.accessToken);
    const previousEditorBundle = editorBundleKey
      ? await captureCurrentValue<CourseEditorBundle>(editorBundleKey)
      : undefined;

    if (editorBundleKey) {
      const usernameSet = new Set(usernames);
      const userIdSet = new Set(userIds);

      await mutate(
        editorBundleKey,
        (current: CourseEditorBundle | undefined) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            contributors: {
              ...current.contributors,
              data: (current.contributors.data ?? []).filter(
                (contributor: any) =>
                  !userIdSet.has(contributor.user_id) && !usernameSet.has(contributor.user?.username),
              ),
            },
          };
        },
        { revalidate: false },
      );
    }

    try {
      const response = ensureMutationSuccess(await bulkRemoveContributors(courseUuid, usernames, options.accessToken));
      await Promise.all([refreshCourse(), refreshEditorBundle(options.accessToken)]);
      return response;
    } catch (error) {
      if (editorBundleKey) {
        await mutate(editorBundleKey, previousEditorBundle, { revalidate: false });
      }
      throw error;
    }
  };

  return {
    addContributors,
    refreshCourse,
    removeContributors,
    updateContributor,
    updateAccess,
    updateMetadata,
    updateThumbnail,
  };
}
