import { CallStatus, RoutingKey } from '@call-reservation/shared-types';
import { CallRequest } from '../domain/entities/call-request.entity';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import { InvalidStateTransitionError } from '../domain/errors/invalid-state-transition.error';
import { OutboxEvent } from '../domain/outbox-event';
import { CallRequestRepositoryPort } from '../domain/ports/call-request-repository.port';
import { CancelCallUseCase } from './cancel-call.use-case';

const CREATED_AT = new Date('2026-08-03T09:00:00+03:00');

class InMemoryCallRequestRepository implements CallRequestRepositoryPort {
  requests = new Map<string, CallRequest>();
  events: OutboxEvent[] = [];

  async findById(id: string): Promise<CallRequest | null> {
    return this.requests.get(id) ?? null;
  }

  async hasConflictingRequest(): Promise<boolean> {
    return false;
  }

  async create(): Promise<CallRequest> {
    throw new Error('not used by CancelCallUseCase');
  }

  /** Mirrors the Mongo adapter's conditional-match: null if the stored
   * status no longer equals expectedCurrentStatus. */
  async transition(
    callRequest: CallRequest,
    expectedCurrentStatus: CallStatus,
    event?: OutboxEvent,
  ): Promise<CallRequest | null> {
    const current = this.requests.get(callRequest.id as string);

    if (!current || current.status !== expectedCurrentStatus) {
      return null;
    }

    const saved = new CallRequest({
      ...callRequest,
      createdAt: current.createdAt ?? CREATED_AT,
    });
    this.requests.set(saved.id as string, saved);
    if (event) {
      this.events.push(event);
    }
    return saved;
  }

  async setNotes(): Promise<CallRequest | null> {
    throw new Error('not used by CancelCallUseCase');
  }
}

function seedRequest(
  repository: InMemoryCallRequestRepository,
  status: CallStatus,
): void {
  repository.requests.set(
    'req-1',
    new CallRequest({
      id: 'req-1',
      email: 'customer@example.com',
      phoneNumber: '+905551234567',
      scheduledAt: new Date('2026-08-10T10:00:00+03:00'),
      status,
      requestedByUserId: 'user-1',
      createdAt: CREATED_AT,
    }),
  );
}

describe('CancelCallUseCase', () => {
  it('cancels a scheduled call and publishes call.canceled', async () => {
    const repository = new InMemoryCallRequestRepository();
    seedRequest(repository, CallStatus.SCHEDULED);
    const useCase = new CancelCallUseCase(repository);

    const result = await useCase.execute('req-1');

    expect(result.status).toBe(CallStatus.CANCELED);
    expect(repository.events).toEqual([
      {
        routingKey: RoutingKey.CallCanceled,
        payload: {
          requestId: 'req-1',
          email: 'customer@example.com',
          canceledAt: expect.any(String),
        },
      },
    ]);
  });

  it('throws if the call request does not exist', async () => {
    const repository = new InMemoryCallRequestRepository();
    const useCase = new CancelCallUseCase(repository);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      CallRequestNotFoundError,
    );
  });

  it('rejects canceling a request that is still awaiting approval', async () => {
    const repository = new InMemoryCallRequestRepository();
    seedRequest(repository, CallStatus.REQUESTED);
    const useCase = new CancelCallUseCase(repository);

    await expect(useCase.execute('req-1')).rejects.toBeInstanceOf(
      InvalidStateTransitionError,
    );
  });

  it('rejects if the request was transitioned by someone else between the read and the write', async () => {
    const repository = new InMemoryCallRequestRepository();
    seedRequest(repository, CallStatus.SCHEDULED);
    const useCase = new CancelCallUseCase(repository);
    // Simulate a concurrent mark-called winning the race right after our read.
    jest.spyOn(repository, 'transition').mockResolvedValueOnce(null);

    await expect(useCase.execute('req-1')).rejects.toBeInstanceOf(
      InvalidStateTransitionError,
    );
  });
});
