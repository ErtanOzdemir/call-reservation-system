import { CallRequestDto } from '@call-reservation/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import {
  CALL_REQUEST_REPOSITORY,
  CallRequestRepositoryPort,
} from '../domain/ports/call-request-repository.port';
import { toCallRequestDto } from './to-call-request-dto';

@Injectable()
export class ListCallRequestsUseCase {
  constructor(
    @Inject(CALL_REQUEST_REPOSITORY)
    private readonly callRequestRepository: CallRequestRepositoryPort,
  ) {}

  async execute(): Promise<CallRequestDto[]> {
    const callRequests = await this.callRequestRepository.findAll();

    return callRequests.map(toCallRequestDto);
  }
}
