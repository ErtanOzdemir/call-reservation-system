import { InvalidStateTransitionError } from '@call-reservation/call-lifecycle';
import { CallStatus } from '@call-reservation/shared-types';
import { CallNotYetDueError } from '../domain/errors/call-not-yet-due.error';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import { MarkCalledUseCase } from './useCase/mark-called.use-case';
import { MarkCalledUseCaseHandler } from './mark-called.use-case-handler';
import {
  InMemoryCallRequestRepository,
  makeCallRequest,
} from './testing/in-memory-call-request-repository';

describe('MarkCalledUseCaseHandler', () => {
  it('marks a scheduled call as called without publishing an event', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({ id: 'req-1', status: CallStatus.SCHEDULED }),
    );
    const handler = new MarkCalledUseCaseHandler(repository);

    const result = await handler.execute(new MarkCalledUseCase('req-1'));

    expect(result.status).toBe(CallStatus.CALLED);
    expect(repository.events).toEqual([]);
  });

  it('throws if the call request does not exist', async () => {
    const repository = new InMemoryCallRequestRepository();
    const handler = new MarkCalledUseCaseHandler(repository);

    await expect(
      handler.execute(new MarkCalledUseCase('missing')),
    ).rejects.toBeInstanceOf(CallRequestNotFoundError);
  });

  it('rejects marking a request as called before it is scheduled', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({ id: 'req-1', status: CallStatus.REQUESTED }),
    );
    const handler = new MarkCalledUseCaseHandler(repository);

    await expect(
      handler.execute(new MarkCalledUseCase('req-1')),
    ).rejects.toBeInstanceOf(InvalidStateTransitionError);
  });

  it('rejects marking a call as called before its scheduled time', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({
        id: 'req-1',
        status: CallStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    );
    const handler = new MarkCalledUseCaseHandler(repository);

    await expect(
      handler.execute(new MarkCalledUseCase('req-1')),
    ).rejects.toBeInstanceOf(CallNotYetDueError);
  });

  it('rejects if the request was transitioned by someone else between the read and the write', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({ id: 'req-1', status: CallStatus.SCHEDULED }),
    );
    const handler = new MarkCalledUseCaseHandler(repository);
    // Simulate a concurrent cancel winning the race right after our read.
    jest.spyOn(repository, 'transition').mockResolvedValueOnce(null);

    await expect(
      handler.execute(new MarkCalledUseCase('req-1')),
    ).rejects.toBeInstanceOf(InvalidStateTransitionError);
  });
});
