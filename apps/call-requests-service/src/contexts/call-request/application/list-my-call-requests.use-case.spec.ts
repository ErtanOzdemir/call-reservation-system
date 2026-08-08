import { CallStatus } from '@call-reservation/shared-types';
import { CallRequest } from '../domain/entities/call-request.entity';
import { CallRequestRepositoryPort } from '../domain/ports/call-request-repository.port';
import { ListMyCallRequestsUseCase } from './list-my-call-requests.use-case';

const CREATED_AT = new Date('2026-08-03T09:00:00+03:00');

class InMemoryCallRequestRepository implements CallRequestRepositoryPort {
  requestsByUserId = new Map<string, CallRequest[]>();

  async findById(): Promise<CallRequest | null> {
    throw new Error('not used by ListMyCallRequestsUseCase');
  }

  async hasConflictingRequest(): Promise<boolean> {
    throw new Error('not used by ListMyCallRequestsUseCase');
  }

  async create(): Promise<CallRequest> {
    throw new Error('not used by ListMyCallRequestsUseCase');
  }

  async transition(): Promise<CallRequest | null> {
    throw new Error('not used by ListMyCallRequestsUseCase');
  }

  async setNotes(): Promise<CallRequest | null> {
    throw new Error('not used by ListMyCallRequestsUseCase');
  }

  async findAll(): Promise<CallRequest[]> {
    throw new Error('not used by ListMyCallRequestsUseCase');
  }

  async findByRequestedByUserId(requestedByUserId: string): Promise<CallRequest[]> {
    return this.requestsByUserId.get(requestedByUserId) ?? [];
  }
}

function makeRequest(
  id: string,
  requestedByUserId: string,
  status: CallStatus,
  notes?: string,
): CallRequest {
  return new CallRequest({
    id,
    email: 'customer@example.com',
    phoneNumber: '+905551234567',
    scheduledAt: new Date('2026-08-10T10:00:00+03:00'),
    status,
    requestedByUserId,
    notes,
    createdAt: CREATED_AT,
  });
}

describe('ListMyCallRequestsUseCase', () => {
  it('returns only the requesting user\'s own call requests', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.requestsByUserId.set('user-1', [
      makeRequest('req-1', 'user-1', CallStatus.REQUESTED),
      makeRequest('req-2', 'user-1', CallStatus.REJECTED),
    ]);
    const useCase = new ListMyCallRequestsUseCase(repository);

    const result = await useCase.execute('user-1');

    expect(result.map((dto) => dto.id)).toEqual(['req-1', 'req-2']);
  });

  it('never exposes the internal admin notes to the requester', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.requestsByUserId.set('user-1', [
      makeRequest('req-1', 'user-1', CallStatus.SCHEDULED, 'Sensitive admin comment'),
    ]);
    const useCase = new ListMyCallRequestsUseCase(repository);

    const result = await useCase.execute('user-1');

    expect(result[0]).not.toHaveProperty('notes');
  });

  it('returns an empty list for a user with no call requests', async () => {
    const repository = new InMemoryCallRequestRepository();
    const useCase = new ListMyCallRequestsUseCase(repository);

    const result = await useCase.execute('user-with-no-requests');

    expect(result).toEqual([]);
  });
});
