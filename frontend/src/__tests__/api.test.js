import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios before importing the api module
vi.mock('axios', () => {
  const mockInstance = {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  };
  return {
    default: {
      create: vi.fn(() => mockInstance),
    },
    __mockInstance: mockInstance,
  };
});

describe('API service exports', () => {
  it('exports all expected functions', async () => {
    const api = await import('../services/api');
    expect(typeof api.getPolicy).toBe('function');
    expect(typeof api.updatePolicy).toBe('function');
    expect(typeof api.getPolicyDefaults).toBe('function');
    expect(typeof api.createRequest).toBe('function');
    expect(typeof api.listRequests).toBe('function');
    expect(typeof api.getRequestStatus).toBe('function');
    expect(typeof api.getRequestDetails).toBe('function');
    expect(typeof api.getRequestPlan).toBe('function');
    expect(typeof api.triggerGeneration).toBe('function');
    expect(typeof api.getValidation).toBe('function');
    expect(typeof api.getDownloadUrl).toBe('function');
  });

  it('exports a default axios instance', async () => {
    const api = await import('../services/api');
    expect(api.default).toBeDefined();
  });
});

describe('API calls use correct paths', () => {
  let axiosMock;

  beforeEach(async () => {
    vi.resetModules();
    const axiosModule = await import('axios');
    axiosMock = axiosModule.default.create();
    axiosMock.get.mockClear();
    axiosMock.post.mockClear();
    axiosMock.put.mockClear();
  });

  it('getPolicy calls GET /policies', async () => {
    const { getPolicy } = await import('../services/api');
    await getPolicy();
    expect(axiosMock.get).toHaveBeenCalledWith('/policies');
  });

  it('listRequests calls GET /requests', async () => {
    const { listRequests } = await import('../services/api');
    await listRequests();
    expect(axiosMock.get).toHaveBeenCalledWith('/requests');
  });

  it('createRequest calls POST /requests with correct body', async () => {
    const { createRequest } = await import('../services/api');
    await createRequest('build a payment service');
    expect(axiosMock.post).toHaveBeenCalledWith('/requests', {
      serviceRequest: 'build a payment service',
    });
  });

  it('updatePolicy calls PUT /policies with profile', async () => {
    const { updatePolicy } = await import('../services/api');
    const profile = { language: { value: 'Python 3.12' } };
    await updatePolicy(profile);
    expect(axiosMock.put).toHaveBeenCalledWith('/policies', { profile });
  });

  it('triggerGeneration calls POST with selected artifacts', async () => {
    const { triggerGeneration } = await import('../services/api');
    await triggerGeneration('abc123', ['source', 'readme']);
    expect(axiosMock.post).toHaveBeenCalledWith('/requests/abc123/generate', {
      selectedArtifacts: ['source', 'readme'],
    });
  });

  it('getDownloadUrl calls correct URL', async () => {
    const { getDownloadUrl } = await import('../services/api');
    await getDownloadUrl('req-xyz');
    expect(axiosMock.get).toHaveBeenCalledWith('/requests/req-xyz/download');
  });
});
