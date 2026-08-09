import {
  AvailabilityResponse,
  CallRequestResponse,
  CreateCallRequestPayload,
} from '@call-reservation/shared-types';
import { request } from './api-client';

export const callRequestsApi = {
  getAvailability(date: string, token: string): Promise<AvailabilityResponse> {
    return request(`/call-requests/availability?date=${date}`, {}, token);
  },

  reserve(
    payload: CreateCallRequestPayload,
    token: string,
  ): Promise<CallRequestResponse> {
    return request(
      '/call-requests',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    );
  },

  listAll(token: string): Promise<CallRequestResponse[]> {
    return request('/admin/call-requests', {}, token);
  },

  listMine(token: string): Promise<Omit<CallRequestResponse, 'notes'>[]> {
    return request('/call-requests/mine', {}, token);
  },

  approve(id: string, token: string): Promise<CallRequestResponse> {
    return request(`/admin/call-requests/${id}/approve`, { method: 'PATCH' }, token);
  },

  reject(id: string, token: string): Promise<CallRequestResponse> {
    return request(`/admin/call-requests/${id}/reject`, { method: 'PATCH' }, token);
  },

  cancel(id: string, token: string): Promise<CallRequestResponse> {
    return request(`/admin/call-requests/${id}/cancel`, { method: 'PATCH' }, token);
  },

  markCalled(id: string, token: string): Promise<CallRequestResponse> {
    return request(`/admin/call-requests/${id}/called`, { method: 'PATCH' }, token);
  },

  setNotes(id: string, notes: string, token: string): Promise<CallRequestResponse> {
    return request(
      `/admin/call-requests/${id}/notes`,
      { method: 'PATCH', body: JSON.stringify({ notes }) },
      token,
    );
  },
};
