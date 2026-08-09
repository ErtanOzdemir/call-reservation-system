import { CallRequestResponse } from '@call-reservation/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import {
  CALL_REQUEST_REPOSITORY,
  CallRequestRepositoryPort,
} from '../domain/ports/call-request-repository.port';
import { toCallRequestResponse } from './to-call-request-response';

@Injectable()
export class ListMyCallRequestsUseCase {
  constructor(
    @Inject(CALL_REQUEST_REPOSITORY)
    private readonly callRequestRepository: CallRequestRepositoryPort,
  ) {}

  async execute(requestedByUserId: string): Promise<CallRequestResponse[]> {
    const callRequests =
      await this.callRequestRepository.findByRequestedByUserId(requestedByUserId);


    return callRequests.map((callRequest) => {
      const response = toCallRequestResponse(callRequest);
      delete response.notes;
      return response;
    });
  }
}
