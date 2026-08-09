import { CallStatus, RoutingKey } from '@call-reservation/shared-types';
import { DateTime } from 'luxon';
import { InvalidReservationTimeError } from '../domain/errors/invalid-reservation-time.error';
import { SlotUnavailableError } from '../domain/errors/slot-unavailable.error';
import { ReserveCallUseCase } from './useCase/reserve-call.use-case';
import { ReserveCallUseCaseHandler } from './reserve-call.use-case-handler';
import {
  DEFAULT_CREATED_AT,
  InMemoryCallRequestRepository,
} from './testing/in-memory-call-request-repository';

function nextIstanbulMondayAt(hour: number, minute = 0): Date {
  return DateTime.now()
    .setZone('Europe/Istanbul')
    .plus({ weeks: 1 })
    .set({ weekday: 1, hour, minute, second: 0, millisecond: 0 })
    .toJSDate();
}

describe('ReserveCallUseCaseHandler', () => {
  it('books a valid slot and returns the persisted request', async () => {
    const repository = new InMemoryCallRequestRepository();
    const handler = new ReserveCallUseCaseHandler(repository);
    const scheduledAt = nextIstanbulMondayAt(10);

    const result = await handler.execute(
      new ReserveCallUseCase(
        ' Customer@Example.com ',
        ' +905551234567 ',
        scheduledAt.toISOString(),
        'user-1',
      ),
    );

    expect(result).toEqual({
      id: expect.any(String),
      email: 'customer@example.com',
      phoneNumber: '+905551234567',
      scheduledAt,
      durationMinutes: 30,
      status: CallStatus.REQUESTED,
      requestedByUserId: 'user-1',
      createdAt: DEFAULT_CREATED_AT,
    });
    expect(repository.requests.size).toBe(1);
    expect(repository.events).toEqual([
      {
        eventId: expect.any(String),
        routingKey: RoutingKey.CallRequested,
        payload: {
          requestId: result.id,
          email: 'customer@example.com',
          phoneNumber: '+905551234567',
          scheduledAt: scheduledAt.toISOString(),
          requestedByUserId: 'user-1',
        },
      },
    ]);
  });

  it('rejects a slot outside working hours without persisting anything', async () => {
    const repository = new InMemoryCallRequestRepository();
    const handler = new ReserveCallUseCaseHandler(repository);
    const outsideWorkingHours = nextIstanbulMondayAt(20);

    await expect(
      handler.execute(
        new ReserveCallUseCase(
          'customer@example.com',
          '+905551234567',
          outsideWorkingHours.toISOString(),
          'user-1',
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidReservationTimeError);
    expect(repository.requests.size).toBe(0);
  });

  it('rejects an already-booked slot without persisting anything', async () => {
    const repository = new InMemoryCallRequestRepository();
    const scheduledAt = nextIstanbulMondayAt(10);
    repository.conflictingSlot = scheduledAt;
    const handler = new ReserveCallUseCaseHandler(repository);

    await expect(
      handler.execute(
        new ReserveCallUseCase(
          'customer@example.com',
          '+905551234567',
          scheduledAt.toISOString(),
          'user-1',
        ),
      ),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
    expect(repository.requests.size).toBe(0);
  });
});
