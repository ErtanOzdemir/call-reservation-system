import { Inject, Injectable } from '@nestjs/common';
import { CallRequest } from '../domain/entities/call-request.entity';
import {
  CALL_REQUEST_REPOSITORY,
  CallRequestRepositoryPort,
} from '../domain/ports/call-request-repository.port';
import { ListMyCallRequestsUseCase } from './list-my-call-requests.use-case';

@Injectable()
export class ListMyCallRequestsUseCaseHandler {
  constructor(
    @Inject(CALL_REQUEST_REPOSITORY)
    private readonly callRequestRepository: CallRequestRepositoryPort,
  ) {}

  async execute(useCase: ListMyCallRequestsUseCase): Promise<CallRequest[]> {
    const callRequests = await this.callRequestRepository.findByRequestedByUserId(
      useCase.requestedByUserId,
    );

    // Notes are internal admin annotations — never expose them to the requester.
    return callRequests.map(
      (callRequest) => new CallRequest({ ...callRequest, notes: undefined }),
    );
  }
}
