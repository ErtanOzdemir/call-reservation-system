import { CallStatus, RoutingKey } from '@call-reservation/shared-types';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import { InvalidStateTransitionError } from '../domain/errors/invalid-state-transition.error';
import { CancelCallUseCase } from './useCase/cancel-call.use-case';
import { CancelCallUseCaseHandler } from './cancel-call.use-case-handler';
import {
  InMemoryCallRequestRepository,
  makeCallRequest,
} from './testing/in-memory-call-request-repository';

describe('CancelCallUseCaseHandler', () => {
  it('cancels a scheduled call and publishes call.canceled', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({ id: 'req-1', status: CallStatus.SCHEDULED }),
    );
    const handler = new CancelCallUseCaseHandler(repository);

    const result = await handler.execute(new CancelCallUseCase('req-1'));

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
    const handler = new CancelCallUseCaseHandler(repository);

    await expect(
      handler.execute(new CancelCallUseCase('missing')),
    ).rejects.toBeInstanceOf(CallRequestNotFoundError);
  });

  it('rejects canceling a request that is still awaiting approval', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({ id: 'req-1', status: CallStatus.REQUESTED }),
    );
    const handler = new CancelCallUseCaseHandler(repository);

    await expect(
      handler.execute(new CancelCallUseCase('req-1')),
    ).rejects.toBeInstanceOf(InvalidStateTransitionError);
  });

  it('rejects if the request was transitioned by someone else between the read and the write', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({ id: 'req-1', status: CallStatus.SCHEDULED }),
    );
    const handler = new CancelCallUseCaseHandler(repository);
    // Simulate a concurrent mark-called winning the race right after our read.
    jest.spyOn(repository, 'transition').mockResolvedValueOnce(null);

    await expect(
      handler.execute(new CancelCallUseCase('req-1')),
    ).rejects.toBeInstanceOf(InvalidStateTransitionError);
  });
});
