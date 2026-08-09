import { CallStatus } from '@call-reservation/shared-types';
import {
  CallRequest,
  CallRequestProps,
} from '../../domain/entities/call-request.entity';
import { CallRequestRepositoryPort } from '../../domain/ports/call-request-repository.port';
import { OutboxEvent } from '../../domain/outbox-event';

export const DEFAULT_CREATED_AT = new Date('2026-08-03T09:00:00+03:00');


export function makeCallRequest(
  overrides: Partial<CallRequestProps> & { id: string; status: CallStatus },
): CallRequest {
  return new CallRequest({
    email: 'customer@example.com',
    phoneNumber: '+905551234567',
    scheduledAt: new Date('2026-08-10T10:00:00+03:00'),
    requestedByUserId: 'user-1',
    createdAt: DEFAULT_CREATED_AT,
    ...overrides,
  });
}

export class InMemoryCallRequestRepository
  implements CallRequestRepositoryPort
{
  requests = new Map<string, CallRequest>();
  events: OutboxEvent[] = [];
  conflictingSlot: Date | null = null;

  seed(callRequest: CallRequest): void {
    this.requests.set(callRequest.id as string, callRequest);
  }

  async findById(id: string): Promise<CallRequest | null> {
    return this.requests.get(id) ?? null;
  }

  async hasConflictingRequest(scheduledAt: Date): Promise<boolean> {
    return (
      this.conflictingSlot !== null &&
      this.conflictingSlot.getTime() === scheduledAt.getTime()
    );
  }

  async create(
    callRequest: CallRequest,
    event: OutboxEvent,
  ): Promise<CallRequest> {
    const saved = new CallRequest({
      ...callRequest,
      createdAt: callRequest.createdAt ?? DEFAULT_CREATED_AT,
    });
    this.requests.set(saved.id as string, saved);
    this.events.push(event);
    return saved;
  }

  async transition(
    callRequest: CallRequest,
    expectedCurrentStatus: CallStatus,
    event?: OutboxEvent,
  ): Promise<CallRequest | null> {
    const current = this.requests.get(callRequest.id as string);

    if (!current || current.status !== expectedCurrentStatus) {
      return null;
    }

    const saved = new CallRequest({
      ...callRequest,
      createdAt: current.createdAt ?? DEFAULT_CREATED_AT,
    });
    this.requests.set(saved.id as string, saved);
    if (event) {
      this.events.push(event);
    }
    return saved;
  }

  async setNotes(id: string, notes: string): Promise<CallRequest | null> {
    const current = this.requests.get(id);

    if (!current) {
      return null;
    }

    const saved = new CallRequest({ ...current, notes });
    this.requests.set(id, saved);
    return saved;
  }

  async findAll(): Promise<CallRequest[]> {
    return [...this.requests.values()];
  }

  async findByRequestedByUserId(
    requestedByUserId: string,
  ): Promise<CallRequest[]> {
    return [...this.requests.values()].filter(
      (request) => request.requestedByUserId === requestedByUserId,
    );
  }
}
