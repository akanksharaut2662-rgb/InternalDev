/**
 * API client for the IDP backend.
 * Uses Axios with the API Gateway base URL from environment variable.
 */

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Policy endpoints ─────────────────────────────────────

export const getPolicy = () => api.get('/policies');
export const updatePolicy = (profile) => api.put('/policies', { profile });
export const getPolicyDefaults = () => api.get('/policies/defaults');

// ─── Request endpoints ────────────────────────────────────

export const createRequest = (serviceRequest) =>
  api.post('/requests', { serviceRequest });

export const listRequests = () => api.get('/requests');

export const getRequestStatus = (id) => api.get(`/requests/${id}/status`);

export const getRequestDetails = (id) => api.get(`/requests/${id}`);

export const getRequestPlan = (id) => api.get(`/requests/${id}/plan`);

export const triggerGeneration = (id, selectedArtifacts) =>
  api.post(`/requests/${id}/generate`, { selectedArtifacts });

// ─── Validation endpoints ─────────────────────────────────

export const getValidation = (id) => api.get(`/requests/${id}/validation`);

// ─── Download endpoints ───────────────────────────────────

export const getDownloadUrl = (id) => api.get(`/requests/${id}/download`);

export default api;
