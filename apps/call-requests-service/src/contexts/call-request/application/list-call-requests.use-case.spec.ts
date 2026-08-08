import { CallStatus } from '@call-reservation/shared-types';
import { CallRequest } from '../domain/entities/call-request.entity';
import { CallRequestRepositoryPort } from '../domain/ports/call-request-repository.port';
import { ListCallRequestsUseCase } from './list-call-requests.use-case';

const CREATED_AT = new Date('2026-08-03T09:00:00+03:00');

class InMemoryCallRequestRepository implements CallRequestRepositoryPort {
  requests: CallRequest[] = [];

  async findById(): Promise<CallRequest | null> {
    throw new Error('not used by ListCallRequestsUseCase');
  }

  async hasConflictingRequest(): Promise<boolean> {
    throw new Error('not used by ListCallRequestsUseCase');
  }

  async create(): Promise<CallRequest> {
    throw new Error('not used by ListCallRequestsUseCase');
  }

  async transition(): Promise<CallRequest | null> {
    throw new Error('not used by ListCallRequestsUseCase');
  }

  async setNotes(): Promise<CallRequest | null> {
    throw new Error('not used by ListCallRequestsUseCase');
  }

  async findByRequestedByUserId(): Promise<CallRequest[]> {
    throw new Error('not used by ListCallRequestsUseCase');
  }

  async findAll(): Promise<CallRequest[]> {
    return this.requests;
  }
}

function makeRequest(id: string, status: CallStatus): CallRequest {
  return new CallRequest({
    id,
    email: 'customer@example.com',
    phoneNumber: '+905551234567',
    scheduledAt: new Date('2026-08-10T10:00:00+03:00'),
    status,
    requestedByUserId: 'user-1',
    createdAt: CREATED_AT,
  });
}

describe('ListCallRequestsUseCase', () => {
  it('maps every call request from the repository to a DTO', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.requests = [
      makeRequest('req-1', CallStatus.REQUESTED),
      makeRequest('req-2', CallStatus.SCHEDULED),
    ];
    const useCase = new ListCallRequestsUseCase(repository);

    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result.map((dto) => dto.id)).toEqual(['req-1', 'req-2']);
    expect(result[1].status).toBe(CallStatus.SCHEDULED);
  });

  it('returns an empty list when there are no call requests', async () => {
    const repository = new InMemoryCallRequestRepository();
    const useCase = new ListCallRequestsUseCase(repository);

    const result = await useCase.execute();

    expect(result).toEqual([]);
  });
});
