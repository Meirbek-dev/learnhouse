import createClient from 'openapi-fetch';

import { getAPIUrl, getServerAPIUrl } from '@/services/config/config';
import type { paths } from '@/lib/api/generated';

export const createApiClient = (baseUrl = getAPIUrl()) => createClient<paths>({ baseUrl });

export const createServerApiClient = () => createClient<paths>({ baseUrl: getServerAPIUrl() });

export type ApiClient = ReturnType<typeof createApiClient>;
