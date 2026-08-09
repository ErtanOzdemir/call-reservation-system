import { CallStatus } from '@call-reservation/shared-types';
import { ListCallRequestsUseCaseHandler } from './list-call-requests.use-case-handler';
import {
  InMemoryCallRequestRepository,
  makeCallRequest,
} from './testing/in-memory-call-request-repository';

describe('ListCallRequestsUseCaseHandler', () => {
  it('returns every call request from the repository', async () => {
    const repository = new InMemoryCallRequestRepository();
    repository.seed(
      makeCallRequest({ id: 'req-1', status: CallStatus.REQUESTED }),
    );
    repository.seed(
      makeCallRequest({ id: 'req-2', status: CallStatus.SCHEDULED }),
    );
    const handler = new ListCallRequestsUseCaseHandler(repository);

    const result = await handler.execute();

    expect(result).toHaveLength(2);
    expect(result.map((callRequest) => callRequest.id)).toEqual([
      'req-1',
      'req-2',
    ]);
    expect(result[1].status).toBe(CallStatus.SCHEDULED);
  });

  it('returns an empty list when there are no call requests', async () => {
    const repository = new InMemoryCallRequestRepository();
    const handler = new ListCallRequestsUseCaseHandler(repository);

    const result = await handler.execute();

    expect(result).toEqual([]);
  });
});
