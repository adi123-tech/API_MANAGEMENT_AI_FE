import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return apiClient(originalRequest);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

// Auth
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    apiClient.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    apiClient.post('/auth/login', data),
  logout: () => apiClient.post('/auth/logout'),
  getMe: () => apiClient.get('/auth/me'),
  updateMe: (data: { name: string }) => apiClient.patch('/auth/me', data),
};

// Projects
export const projectsApi = {
  list: () => apiClient.get('/projects'),
  create: (data: unknown) => apiClient.post('/projects', data),
  get: (id: string) => apiClient.get(`/projects/${id}`),
  update: (id: string, data: unknown) => apiClient.patch(`/projects/${id}`, data),
  delete: (id: string) => apiClient.delete(`/projects/${id}`),
};

// API Tests
export const testsApi = {
  list: (projectId: string, params?: Record<string, unknown>) =>
    apiClient.get(`/projects/${projectId}/tests`, { params }),
  create: (projectId: string, data: unknown) =>
    apiClient.post(`/projects/${projectId}/tests`, data),
  get: (projectId: string, id: string) =>
    apiClient.get(`/projects/${projectId}/tests/${id}`),
  update: (projectId: string, id: string, data: unknown) =>
    apiClient.patch(`/projects/${projectId}/tests/${id}`, data),
  delete: (projectId: string, id: string) =>
    apiClient.delete(`/projects/${projectId}/tests/${id}`),
  clone: (projectId: string, id: string) =>
    apiClient.post(`/projects/${projectId}/tests/${id}/clone`),
  execute: (projectId: string, testId: string, data?: unknown) =>
    apiClient.post(`/projects/${projectId}/tests/${testId}/execute`, data),
  runSync: (projectId: string, testId: string, data?: unknown) =>
    apiClient.post(`/projects/${projectId}/tests/${testId}/run-sync`, data),
  generateAndRun: (projectId: string, testId: string, data?: unknown) =>
    apiClient.post(`/projects/${projectId}/tests/${testId}/generate-and-run`, data),
  generateSmartRun: (projectId: string, testId: string, data?: unknown) =>
    apiClient.post(`/projects/${projectId}/tests/${testId}/generate-smart-run`, data),
  generateWithAI: (projectId: string, data: unknown) =>
    apiClient.post(`/projects/${projectId}/tests/ai/generate`, data),
  importSwagger: (projectId: string, spec: unknown) =>
    apiClient.post(`/projects/${projectId}/tests/swagger/import`, { spec }),
  getFolders: (projectId: string) =>
    apiClient.get(`/projects/${projectId}/tests/folders`),
};

// Executions
export const executionsApi = {
  list: (projectId: string, params?: Record<string, unknown>) =>
    apiClient.get(`/projects/${projectId}/executions`, { params }),
  get: (projectId: string, id: string) =>
    apiClient.get(`/projects/${projectId}/executions/${id}`),
  cancel: (projectId: string, id: string) =>
    apiClient.post(`/projects/${projectId}/executions/${id}/cancel`),
  loadTest: (projectId: string, data: unknown) =>
    apiClient.post(`/projects/${projectId}/executions/load-test`, data),
};

// Workflows
export const workflowsApi = {
  list: (projectId: string) => apiClient.get(`/projects/${projectId}/workflows`),
  create: (projectId: string, data: unknown) =>
    apiClient.post(`/projects/${projectId}/workflows`, data),
  get: (projectId: string, id: string) =>
    apiClient.get(`/projects/${projectId}/workflows/${id}`),
  update: (projectId: string, id: string, data: unknown) =>
    apiClient.patch(`/projects/${projectId}/workflows/${id}`, data),
  delete: (projectId: string, id: string) =>
    apiClient.delete(`/projects/${projectId}/workflows/${id}`),
  execute: (projectId: string, workflowId: string, data?: unknown) =>
    apiClient.post(`/projects/${projectId}/workflows/${workflowId}/execute`, data),
};

// Environments
export const environmentsApi = {
  list: (projectId: string) => apiClient.get(`/projects/${projectId}/environments`),
  create: (projectId: string, data: unknown) =>
    apiClient.post(`/projects/${projectId}/environments`, data),
  get: (projectId: string, id: string) =>
    apiClient.get(`/projects/${projectId}/environments/${id}`),
  update: (projectId: string, id: string, data: unknown) =>
    apiClient.patch(`/projects/${projectId}/environments/${id}`, data),
  delete: (projectId: string, id: string) =>
    apiClient.delete(`/projects/${projectId}/environments/${id}`),
};

// Reports
export const reportsApi = {
  list: (projectId: string, params?: Record<string, unknown>) =>
    apiClient.get(`/projects/${projectId}/reports`, { params }),
  get: (projectId: string, id: string) =>
    apiClient.get(`/projects/${projectId}/reports/${id}`),
  generate: (projectId: string, executionId: string) =>
    apiClient.post(`/projects/${projectId}/reports/executions/${executionId}`),
  dashboard: (projectId: string) =>
    apiClient.get(`/projects/${projectId}/reports/dashboard`),
};

// Schedules
export const schedulesApi = {
  list: (projectId: string) => apiClient.get(`/projects/${projectId}/schedules`),
  create: (projectId: string, data: unknown) =>
    apiClient.post(`/projects/${projectId}/schedules`, data),
  update: (projectId: string, id: string, data: unknown) =>
    apiClient.patch(`/projects/${projectId}/schedules/${id}`, data),
  delete: (projectId: string, id: string) =>
    apiClient.delete(`/projects/${projectId}/schedules/${id}`),
  toggle: (projectId: string, id: string) =>
    apiClient.post(`/projects/${projectId}/schedules/${id}/toggle`),
};

// AI
export const aiApi = {
  validateRequest: (projectId: string, data: unknown) =>
    apiClient.post(`/projects/${projectId}/ai/validate-request`, data),
  validateResponse: (projectId: string, data: unknown) =>
    apiClient.post(`/projects/${projectId}/ai/validate-response`, data),
  analyzeFailure: (projectId: string, data: unknown) =>
    apiClient.post(`/projects/${projectId}/ai/analyze-failure`, data),
  generateAssertions: (projectId: string, data: unknown) =>
    apiClient.post(`/projects/${projectId}/ai/generate-assertions`, data),
  getAnalyses: (projectId: string, params?: Record<string, unknown>) =>
    apiClient.get(`/projects/${projectId}/ai/analyses`, { params }),
};
