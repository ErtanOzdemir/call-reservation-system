import { CallStatus, RoutingKey } from '@call-reservation/shared-types';
import { DateTime } from 'luxon';
import { CallRequest } from '../domain/entities/call-request.entity';
import { InvalidReservationTimeError } from '../domain/errors/invalid-reservation-time.error';
import { SlotUnavailableError } from '../domain/errors/slot-unavailable.error';
import { OutboxEvent } from '../domain/outbox-event';
import { CallRequestRepositoryPort } from '../domain/ports/call-request-repository.port';
import { ReserveCallUseCase } from './reserve-call.use-case';

const PERSISTED_AT = new Date('2026-08-03T09:00:00+03:00');

function nextIstanbulMondayAt(hour: number, minute = 0): Date {
  return DateTime.now()
    .setZone('Europe/Istanbul')
    .plus({ weeks: 1 })
    .set({ weekday: 1, hour, minute, second: 0, millisecond: 0 })
    .toJSDate();
}

class InMemoryCallRequestRepository implements CallRequestRepositoryPort {
  saved: { callRequest: CallRequest; event: OutboxEvent }[] = [];
  conflictingSlot: Date | null = null;

  async findById(): Promise<CallRequest | null> {
    return null;
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
    const savedCallRequest = new CallRequest({
      ...callRequest,
      createdAt: PERSISTED_AT,
    });
    this.saved.push({ callRequest: savedCallRequest, event });
    return savedCallRequest;
  }

  async transition(): Promise<CallRequest | null> {
    throw new Error('not used by ReserveCallUseCase');
  }

  async setNotes(): Promise<CallRequest | null> {
    throw new Error('not used by ReserveCallUseCase');
  }

  async findAll(): Promise<CallRequest[]> {
    throw new Error('not used by ReserveCallUseCase');
  }
}

describe('ReserveCallUseCase', () => {
  it('books a valid slot and returns the persisted request', async () => {
    const repository = new InMemoryCallRequestRepository();
    const useCase = new ReserveCallUseCase(repository);
    const scheduledAt = nextIstanbulMondayAt(10);

    const result = await useCase.execute(
      {
        email: ' Customer@Example.com ',
        phoneNumber: ' +905551234567 ',
        scheduledAt: scheduledAt.toISOString(),
      },
      'user-1',
    );

    expect(result).toEqual({
      id: expect.any(String),
      email: 'customer@example.com',
      phoneNumber: '+905551234567',
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes: 30,
      status: CallStatus.REQUESTED,
      requestedByUserId: 'user-1',
      createdAt: PERSISTED_AT.toISOString(),
    });
    expect(repository.saved).toHaveLength(1);
    expect(repository.saved[0].event).toEqual({
      routingKey: RoutingKey.CallRequested,
      payload: {
        requestId: repository.saved[0].callRequest.id,
        email: 'customer@example.com',
        phoneNumber: '+905551234567',
        scheduledAt: scheduledAt.toISOString(),
        requestedByUserId: 'user-1',
      },
    });
  });

  it('rejects a slot outside working hours without persisting anything', async () => {
    const repository = new InMemoryCallRequestRepository();
    const useCase = new ReserveCallUseCase(repository);
    const outsideWorkingHours = nextIstanbulMondayAt(20);

    await expect(
      useCase.execute(
        {
          email: 'customer@example.com',
          phoneNumber: '+905551234567',
          scheduledAt: outsideWorkingHours.toISOString(),
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(InvalidReservationTimeError);
    expect(repository.saved).toHaveLength(0);
  });

  it('rejects an already-booked slot without persisting anything', async () => {
    const repository = new InMemoryCallRequestRepository();
    const scheduledAt = nextIstanbulMondayAt(10);
    repository.conflictingSlot = scheduledAt;
    const useCase = new ReserveCallUseCase(repository);

    await expect(
      useCase.execute(
        {
          email: 'customer@example.com',
          phoneNumber: '+905551234567',
          scheduledAt: scheduledAt.toISOString(),
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
    expect(repository.saved).toHaveLength(0);
  });
});
