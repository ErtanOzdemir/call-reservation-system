import { CallStatus } from '@call-reservation/shared-types';
import { CallRequest } from '../domain/entities/call-request.entity';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import { CallRequestRepositoryPort } from '../domain/ports/call-request-repository.port';
import { SetCallRequestNotesUseCase } from './set-call-request-notes.use-case';
import { SetCallRequestNotesUseCaseHandler } from './set-call-request-notes.use-case-handler';

const CREATED_AT = new Date('2026-08-03T09:00:00+03:00');

class InMemoryCallRequestRepository implements CallRequestRepositoryPort {
  requests = new Map<string, CallRequest>();

  async findById(id: string): Promise<CallRequest | null> {
    return this.requests.get(id) ?? null;
  }

  async hasConflictingRequest(): Promise<boolean> {
    return false;
  }

  async create(): Promise<CallRequest> {
    throw new Error('not used by SetCallRequestNotesUseCaseHandler');
  }

  async transition(): Promise<CallRequest | null> {
    throw new Error('not used by SetCallRequestNotesUseCaseHandler');
  }

  async setNotes(id: string, notes: string): Promise<CallRequest | null> {
    const current = this.requests.get(id);

    if (!current) {
      return null;
    }

    const saved = new CallRequest({ ...current, notes });
    this.requests.set(id, saved);
    return saved;
  }

  async findAll(): Promise<CallRequest[]> {
    throw new Error('not used by SetCallRequestNotesUseCaseHandler');
  }

  async findByRequestedByUserId(): Promise<CallRequest[]> {
    throw new Error('not used by SetCallRequestNotesUseCaseHandler');
  }
}

function seedRequest(repository: InMemoryCallRequestRepository): void {
  repository.requests.set(
    'req-1',
    new CallRequest({
      id: 'req-1',
      email: 'customer@example.com',
      phoneNumber: '+905551234567',
      scheduledAt: new Date('2026-08-10T10:00:00+03:00'),
      status: CallStatus.REQUESTED,
      requestedByUserId: 'user-1',
      createdAt: CREATED_AT,
    }),
  );
}

describe('SetCallRequestNotesUseCaseHandler', () => {
  it('sets the notes on an existing call request and publishes nothing', async () => {
    const repository = new InMemoryCallRequestRepository();
    seedRequest(repository);
    const handler = new SetCallRequestNotesUseCaseHandler(repository);

    const result = await handler.execute(
      new SetCallRequestNotesUseCase('req-1', 'Customer asked to reschedule.'),
    );

    expect(result.notes).toBe('Customer asked to reschedule.');
  });

  it('overwrites existing notes', async () => {
    const repository = new InMemoryCallRequestRepository();
    seedRequest(repository);
    const handler = new SetCallRequestNotesUseCaseHandler(repository);

    await handler.execute(
      new SetCallRequestNotesUseCase('req-1', 'First note.'),
    );
    const result = await handler.execute(
      new SetCallRequestNotesUseCase('req-1', 'Second note.'),
    );

    expect(result.notes).toBe('Second note.');
  });

  it('throws if the call request does not exist', async () => {
    const repository = new InMemoryCallRequestRepository();
    const handler = new SetCallRequestNotesUseCaseHandler(repository);

    await expect(
      handler.execute(new SetCallRequestNotesUseCase('missing', 'Some note.')),
    ).rejects.toBeInstanceOf(CallRequestNotFoundError);
  });
});
