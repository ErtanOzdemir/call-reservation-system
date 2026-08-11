import {
  CallStatus,
  InvalidStateTransitionError,
  RoutingKey,
} from '@call-reservation/shared-types';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import { RejectCallUseCase } from './useCase/reject-call.use-case';
import { RejectCallUseCaseHandler } from './reject-call.use-case-handler';
import {
  InMemoryCallRequestRepository,
  makeCallRequest,
} from './testing/in-memory-call-request-repository';

describe('RejectCallUseCaseHandler', () => {
  it('rejects a requested call and publishes call.rejected', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({ id: 'req-1', status: CallStatus.REQUESTED }),
    );
    const handler = new RejectCallUseCaseHandler(repository);

    const result = await handler.execute(new RejectCallUseCase('req-1'));

    expect(result.status).toBe(CallStatus.REJECTED);
    expect(repository.events).toEqual([
      {
        eventId: expect.any(String),
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
    const handler = new RejectCallUseCaseHandler(repository);

    await expect(
      handler.execute(new RejectCallUseCase('missing')),
    ).rejects.toBeInstanceOf(CallRequestNotFoundError);
  });

  it('rejects rejecting an already-scheduled request', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({ id: 'req-1', status: CallStatus.SCHEDULED }),
    );
    const handler = new RejectCallUseCaseHandler(repository);

    await expect(
      handler.execute(new RejectCallUseCase('req-1')),
    ).rejects.toBeInstanceOf(InvalidStateTransitionError);
  });

  it('rejects if the request was transitioned by someone else between the read and the write', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({ id: 'req-1', status: CallStatus.REQUESTED }),
    );
    const handler = new RejectCallUseCaseHandler(repository);
    // Simulate a concurrent approve winning the race right after our read.
    jest.spyOn(repository, 'transition').mockResolvedValueOnce(null);

    await expect(
      handler.execute(new RejectCallUseCase('req-1')),
    ).rejects.toBeInstanceOf(InvalidStateTransitionError);
  });
});
