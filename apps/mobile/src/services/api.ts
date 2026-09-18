import { APIClient } from '@4by4/api-client';

import { environment } from '@/config/environment';

export const apiClient = new APIClient({ baseUrl: environment.apiBaseUrl });
