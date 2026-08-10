import { CallStatus } from '@call-reservation/shared-types';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { InMemoryScheduledCallRepository } from '../state/testing/in-memory-scheduled-call-repository';
import { DailyDigestService } from './daily-digest.service';
import { InMemoryPendingDigestRepository } from './testing/in-memory-pending-digest-repository';

function createConfigServiceMock(): ConfigService {
  return {
    getOrThrow: jest.fn(() => 'admin@call-reservation.local'),
  } as unknown as ConfigService;
}

function tomorrowIstanbul(): DateTime {
  return DateTime.now()
    .setZone('Europe/Istanbul')
    .plus({ days: 1 })
    .startOf('day');
}

describe('DailyDigestService', () => {
  it("queues digest.due with tomorrow's SCHEDULED calls, read from local state only", async () => {
    const pendingDigestRepository = new InMemoryPendingDigestRepository();
    const scheduledCallRepository = new InMemoryScheduledCallRepository();
    const tomorrow = tomorrowIstanbul();
    scheduledCallRepository.seed({
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: tomorrow.set({ hour: 10 }).toJSDate(),
      status: CallStatus.SCHEDULED,
    });
    const service = new DailyDigestService(
      scheduledCallRepository,
      pendingDigestRepository,
      createConfigServiceMock(),
    );

    await service.queueDailyDigest();

    expect(pendingDigestRepository.queueCalls).toEqual([
      {
        date: tomorrow.toISODate(),
        eventId: expect.any(String),
        payload: {
          adminEmail: 'admin@call-reservation.local',
          date: tomorrow.toISODate(),
          calls: [
            {
              requestId: 'req-1',
              email: 'customer@example.com',
              scheduledAt: tomorrow.set({ hour: 10 }).toJSDate().toISOString(),
            },
          ],
        },
      },
    ]);
  });

  it('still queues a digest with an empty calls list when nothing is scheduled', async () => {
    const pendingDigestRepository = new InMemoryPendingDigestRepository();
    const scheduledCallRepository = new InMemoryScheduledCallRepository();
    const service = new DailyDigestService(
      scheduledCallRepository,
      pendingDigestRepository,
      createConfigServiceMock(),
    );

    await service.queueDailyDigest();

    const [{ payload }] = pendingDigestRepository.queueCalls;
    expect((payload as { calls: unknown[] }).calls).toEqual([]);
  });

  it('treats an already-queued digest as a no-op rather than a failure', async () => {
    const pendingDigestRepository = new InMemoryPendingDigestRepository();
    const scheduledCallRepository = new InMemoryScheduledCallRepository();
    const tomorrow = tomorrowIstanbul();
    await pendingDigestRepository.queue({
      date: tomorrow.toISODate() as string,
      eventId: 'already-queued',
      payload: {},
    });
    const service = new DailyDigestService(
      scheduledCallRepository,
      pendingDigestRepository,
      createConfigServiceMock(),
    );

    await expect(service.queueDailyDigest()).resolves.toBeUndefined();
  });

  it('logs and swallows a genuine queue failure rather than crashing the scheduler', async () => {
    const pendingDigestRepository = new InMemoryPendingDigestRepository();
    jest
      .spyOn(pendingDigestRepository, 'queue')
      .mockRejectedValueOnce(new Error('mongo down'));
    const scheduledCallRepository = new InMemoryScheduledCallRepository();
    const service = new DailyDigestService(
      scheduledCallRepository,
      pendingDigestRepository,
      createConfigServiceMock(),
    );

    await expect(service.queueDailyDigest()).resolves.toBeUndefined();
  });
});
