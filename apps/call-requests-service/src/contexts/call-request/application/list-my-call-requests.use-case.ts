import { CallRequestDto } from '@call-reservation/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import {
  CALL_REQUEST_REPOSITORY,
  CallRequestRepositoryPort,
} from '../domain/ports/call-request-repository.port';
import { toCallRequestDto } from './to-call-request-dto';

@Injectable()
export class ListMyCallRequestsUseCase {
  constructor(
    @Inject(CALL_REQUEST_REPOSITORY)
    private readonly callRequestRepository: CallRequestRepositoryPort,
  ) {}

  async execute(requestedByUserId: string): Promise<CallRequestDto[]> {
    const callRequests =
      await this.callRequestRepository.findByRequestedByUserId(requestedByUserId);

    // Notes are internal admin annotations — never expose them to the requester.
    return callRequests.map((callRequest) => {
      const dto = toCallRequestDto(callRequest);
      delete dto.notes;
      return dto;
    });
  }
}
