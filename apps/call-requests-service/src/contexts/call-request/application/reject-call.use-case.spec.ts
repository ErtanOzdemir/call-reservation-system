import { CallStatus, RoutingKey } from '@call-reservation/shared-types';
import { CallRequest } from '../domain/entities/call-request.entity';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import { InvalidStateTransitionError } from '../domain/errors/invalid-state-transition.error';
import { OutboxEvent } from '../domain/outbox-event';
import { CallRequestRepositoryPort } from '../domain/ports/call-request-repository.port';
import { RejectCallUseCase } from './reject-call.use-case';

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
    throw new Error('not used by RejectCallUseCase');
  }

  /** Mirrors the Mongo adapter's conditional-match: null if the stored
   * status no longer equals expectedCurrentStatus. */
  async transition(
    callRequest: CallRequest,
    expectedCurrentStatus: CallStatus,
    event: OutboxEvent,
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
    this.events.push(event);
    return saved;
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

describe('RejectCallUseCase', () => {
  it('rejects a requested call and publishes call.rejected', async () => {
    const repository = new InMemoryCallRequestRepository();
    seedRequest(repository, CallStatus.REQUESTED);
    const useCase = new RejectCallUseCase(repository);

    const result = await useCase.execute('req-1');

    expect(result.status).toBe(CallStatus.REJECTED);
    expect(repository.events).toEqual([
      {
        routingKey: RoutingKey.CallRejected,
        payload: {
          requestId: 'req-1',
          email: 'customer@example.com',
          rejectedAt: expect.any(String),
        },
      },
    ]);
  });

  it('throws if the call request does not exist', async () => {
    const repository = new InMemoryCallRequestRepository();
    const useCase = new RejectCallUseCase(repository);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      CallRequestNotFoundError,
    );
  });

  it('rejects rejecting an already-scheduled request', async () => {
    const repository = new InMemoryCallRequestRepository();
    seedRequest(repository, CallStatus.SCHEDULED);
    const useCase = new RejectCallUseCase(repository);

    await expect(useCase.execute('req-1')).rejects.toBeInstanceOf(
      InvalidStateTransitionError,
    );
  });

  it('rejects if the request was transitioned by someone else between the read and the write', async () => {
    const repository = new InMemoryCallRequestRepository();
    seedRequest(repository, CallStatus.REQUESTED);
    const useCase = new RejectCallUseCase(repository);
    // Simulate a concurrent approve winning the race right after our read.
    jest.spyOn(repository, 'transition').mockResolvedValueOnce(null);

    await expect(useCase.execute('req-1')).rejects.toBeInstanceOf(
      InvalidStateTransitionError,
    );
  });
});
