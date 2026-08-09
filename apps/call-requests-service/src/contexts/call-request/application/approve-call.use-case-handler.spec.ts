import { CallStatus, RoutingKey } from '@call-reservation/shared-types';
import { CallRequestNotFoundError } from '../domain/errors/call-request-not-found.error';
import { InvalidStateTransitionError } from '../domain/errors/invalid-state-transition.error';
import { ApproveCallUseCase } from './useCase/approve-call.use-case';
import { ApproveCallUseCaseHandler } from './approve-call.use-case-handler';
import {
  InMemoryCallRequestRepository,
  makeCallRequest,
} from './testing/in-memory-call-request-repository';

describe('ApproveCallUseCaseHandler', () => {
  it('approves a requested call and publishes call.approved', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({ id: 'req-1', status: CallStatus.REQUESTED }),
    );
    const handler = new ApproveCallUseCaseHandler(repository);

    const result = await handler.execute(new ApproveCallUseCase('req-1'));

    expect(result.status).toBe(CallStatus.SCHEDULED);
    expect(repository.events).toEqual([
      {
        routingKey: RoutingKey.CallApproved,
        payload: {
          requestId: 'req-1',
          email: 'customer@example.com',
          scheduledAt: '2026-08-10T07:00:00.000Z',
          approvedAt: expect.any(String),
        },
      },
    ]);
  });

  it('throws if the call request does not exist', async () => {
    const repository = new InMemoryCallRequestRepository();
    const handler = new ApproveCallUseCaseHandler(repository);

    await expect(
      handler.execute(new ApproveCallUseCase('missing')),
    ).rejects.toBeInstanceOf(CallRequestNotFoundError);
  });

  it('rejects approving an already-rejected request', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({ id: 'req-1', status: CallStatus.REJECTED }),
    );
    const handler = new ApproveCallUseCaseHandler(repository);

    await expect(
      handler.execute(new ApproveCallUseCase('req-1')),
    ).rejects.toBeInstanceOf(InvalidStateTransitionError);
  });

  it('rejects if the request was transitioned by someone else between the read and the write', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({ id: 'req-1', status: CallStatus.REQUESTED }),
    );
    const handler = new ApproveCallUseCaseHandler(repository);
    // Simulate a concurrent reject winning the race right after our read.
    jest.spyOn(repository, 'transition').mockResolvedValueOnce(null);

    await expect(
      handler.execute(new ApproveCallUseCase('req-1')),
    ).rejects.toBeInstanceOf(InvalidStateTransitionError);
  });
});
