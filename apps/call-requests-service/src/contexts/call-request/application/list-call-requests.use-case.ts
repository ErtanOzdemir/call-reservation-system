import { CallRequestResponse } from '@call-reservation/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import {
  CALL_REQUEST_REPOSITORY,
  CallRequestRepositoryPort,
} from '../domain/ports/call-request-repository.port';
import { toCallRequestResponse } from './to-call-request-response';

@Injectable()
export class ListCallRequestsUseCase {
  constructor(
    @Inject(CALL_REQUEST_REPOSITORY)
    private readonly callRequestRepository: CallRequestRepositoryPort,
  ) {}

  async execute(): Promise<CallRequestResponse[]> {
    const callRequests = await this.callRequestRepository.findAll();

    return callRequests.map(toCallRequestResponse);
  }
}
