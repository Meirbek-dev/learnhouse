'use client';

import {
  bulkAddContributors,
  bulkRemoveContributors,
  editContributor,
  updateCourseAccess,
  updateCourseMetadata,
  updateCourseThumbnail,
} from '@services/courses/courses';
import type { CourseGeneralValues, CourseAccessValues } from '@/schemas/courseSchemas';
import type { CourseEditorBundle } from '@services/courses/editor';
import { courseKeys } from '@/hooks/courses/courseKeys';
import { assertSuccess } from '@/lib/api/assertSuccess';
import { useCourseEditorStore } from '@/stores/courses';
import { useSWRConfig } from 'swr';

interface MutationOptions {
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
  const { mutate, cache } = useSWRConfig();
  const structureKey = courseKeys.structure(courseUuid, withUnpublishedActivities);
  const detailKey = courseKeys.detail(courseUuid);

  // Read current SWR cache value synchronously — no identity-mutate hack needed.
  const captureSnapshot = (key: string | readonly unknown[]): unknown | undefined =>
    (cache.get(key as any) as any)?.data as unknown | undefined;

  const refreshCourse = async () => {
    await Promise.all([mutate(structureKey), mutate(detailKey)]);
  };

  const refreshEditorBundle = async () => {
    const editorBundleKey = courseKeys.editorBundle(courseUuid);
    if (!editorBundleKey) return;
    await mutate(editorBundleKey as any);
  };

  const updateMetadata = async (payload: Partial<CourseGeneralValues>, options: MutationOptions) => {
    const previousStructure = captureSnapshot(structureKey);

    await mutate(structureKey, (current: any) => (current ? { ...current, ...payload } : current), {
      revalidate: false,
    });

    try {
      const response = assertSuccess(
        await updateCourseMetadata(courseUuid, payload, {
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

  const updateAccess = async (
    payload: Partial<CourseAccessValues & { open_to_contributors?: boolean }>,
    options: MutationOptions,
  ) => {
    const previousStructure = captureSnapshot(structureKey);

    await mutate(structureKey, (current: any) => (current ? { ...current, ...payload } : current), {
      revalidate: false,
    });

    try {
      const response = assertSuccess(
        await updateCourseAccess(courseUuid, payload, {
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
    const response = assertSuccess(
      await updateCourseThumbnail(courseUuid, formData, {
        lastKnownUpdateDate: options.lastKnownUpdateDate,
      }),
    );
    useCourseEditorStore.getState().syncLastKnownUpdateDate(response?.data?.update_date);
    await refreshCourse();
    return response;
  };

  const addContributors = async (usernames: string[], users: ContributorDraftUser[], options: MutationOptions) => {
    const editorBundleKey = courseKeys.editorBundle(courseUuid);
    const previousEditorBundle = editorBundleKey ? captureSnapshot(editorBundleKey) : undefined;

    if (editorBundleKey && users.length > 0) {
      await mutate(
        editorBundleKey as any,
        (current: CourseEditorBundle | undefined) => {
          if (!current) return current;
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
      const response = assertSuccess(await bulkAddContributors(courseUuid, usernames));
      await Promise.all([refreshCourse(), refreshEditorBundle()]);
      return response;
    } catch (error) {
      if (editorBundleKey) await mutate(editorBundleKey as any, previousEditorBundle, { revalidate: false });
      throw error;
    }
  };

  const updateContributor = async (
    contributorUserId: number,
    payload: ContributorMutationPayload,
    options: MutationOptions,
  ) => {
    const editorBundleKey = courseKeys.editorBundle(courseUuid);
    const previousEditorBundle = editorBundleKey ? captureSnapshot(editorBundleKey) : undefined;

    if (editorBundleKey) {
      await mutate(
        editorBundleKey as any,
        (current: CourseEditorBundle | undefined) => {
          if (!current) return current;
          return {
            ...current,
            contributors: {
              ...current.contributors,
              data: (current.contributors.data ?? []).map((contributor: any) =>
                contributor.user_id === contributorUserId ? Object.assign(contributor, payload) : contributor,
              ),
            },
          };
        },
        { revalidate: false },
      );
    }

    try {
      const response = assertSuccess(
        await editContributor(courseUuid, contributorUserId, payload.authorship, payload.authorship_status),
      );
      await Promise.all([refreshCourse(), refreshEditorBundle()]);
      return response;
    } catch (error) {
      if (editorBundleKey) await mutate(editorBundleKey as any, previousEditorBundle, { revalidate: false });
      throw error;
    }
  };

  const removeContributors = async (usernames: string[], userIds: number[], options: MutationOptions) => {
    const editorBundleKey = courseKeys.editorBundle(courseUuid);
    const previousEditorBundle = editorBundleKey ? captureSnapshot(editorBundleKey) : undefined;

    if (editorBundleKey) {
      const usernameSet = new Set(usernames);
      const userIdSet = new Set(userIds);
      await mutate(
        editorBundleKey as any,
        (current: CourseEditorBundle | undefined) => {
          if (!current) return current;
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
      const response = assertSuccess(await bulkRemoveContributors(courseUuid, usernames));
      await Promise.all([refreshCourse(), refreshEditorBundle()]);
      return response;
    } catch (error) {
      if (editorBundleKey) await mutate(editorBundleKey as any, previousEditorBundle, { revalidate: false });
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
