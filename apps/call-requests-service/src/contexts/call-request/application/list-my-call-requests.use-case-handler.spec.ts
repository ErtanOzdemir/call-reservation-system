import { CallStatus } from '@call-reservation/shared-types';
import { ListMyCallRequestsUseCase } from './useCase/list-my-call-requests.use-case';
import { ListMyCallRequestsUseCaseHandler } from './list-my-call-requests.use-case-handler';
import {
  InMemoryCallRequestRepository,
  makeCallRequest,
} from './testing/in-memory-call-request-repository';

describe('ListMyCallRequestsUseCaseHandler', () => {
  it("returns only the requesting user's own call requests", async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({
        id: 'req-1',
        status: CallStatus.REQUESTED,
        requestedByUserId: 'user-1',
      }),
    );
    repository.seed(
      makeCallRequest({
        id: 'req-2',
        status: CallStatus.REJECTED,
        requestedByUserId: 'user-1',
      }),
    );
    const handler = new ListMyCallRequestsUseCaseHandler(repository);

    const result = await handler.execute(
      new ListMyCallRequestsUseCase('user-1'),
    );

    expect(result.map((callRequest) => callRequest.id)).toEqual([
      'req-1',
      'req-2',
    ]);
  });

  it('never exposes the internal admin notes to the requester', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({
        id: 'req-1',
        status: CallStatus.SCHEDULED,
        requestedByUserId: 'user-1',
        notes: 'Sensitive admin comment',
      }),
    );
    const handler = new ListMyCallRequestsUseCaseHandler(repository);

    const result = await handler.execute(
      new ListMyCallRequestsUseCase('user-1'),
    );

    expect(result[0]).not.toHaveProperty('notes');
  });

  it('returns an empty list for a user with no call requests', async () => {
    const repository = new InMemoryCallRequestRepository();
    const handler = new ListMyCallRequestsUseCaseHandler(repository);

    const result = await handler.execute(
      new ListMyCallRequestsUseCase('user-with-no-requests'),
    );

    expect(result).toEqual([]);
  });
});
