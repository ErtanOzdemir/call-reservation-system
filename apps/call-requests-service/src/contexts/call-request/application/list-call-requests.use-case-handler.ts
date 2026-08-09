import { Inject, Injectable } from '@nestjs/common';
import { CallRequest } from '../domain/entities/call-request.entity';
import {
  CALL_REQUEST_REPOSITORY,
  CallRequestRepositoryPort,
} from '../domain/ports/call-request-repository.port';

@Injectable()
export class ListCallRequestsUseCaseHandler {
  constructor(
    @Inject(CALL_REQUEST_REPOSITORY)
    private readonly callRequestRepository: CallRequestRepositoryPort,
  ) {}

  async execute(): Promise<CallRequest[]> {
    return this.callRequestRepository.findAll();
  }
}
