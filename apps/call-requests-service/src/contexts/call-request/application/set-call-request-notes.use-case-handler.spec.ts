import { CallStatus } from '@call-reservation/shared-types';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import { SetCallRequestNotesUseCase } from './set-call-request-notes.use-case';
import { SetCallRequestNotesUseCaseHandler } from './set-call-request-notes.use-case-handler';
import {
  InMemoryCallRequestRepository,
  makeCallRequest,
} from './testing/in-memory-call-request-repository';

describe('SetCallRequestNotesUseCaseHandler', () => {
  it('sets the notes on an existing call request and publishes nothing', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({ id: 'req-1', status: CallStatus.REQUESTED }),
    );
    const handler = new SetCallRequestNotesUseCaseHandler(repository);

    const result = await handler.execute(
      new SetCallRequestNotesUseCase('req-1', 'Customer asked to reschedule.'),
    );

    expect(result.notes).toBe('Customer asked to reschedule.');
  });

  it('overwrites existing notes', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({ id: 'req-1', status: CallStatus.REQUESTED }),
    );
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
