import { CallStatus } from '@call-reservation/shared-types';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { Model } from 'mongoose';
import {
  ScheduledCallInput,
  ScheduledCallRepository,
} from '../state/scheduled-call.repository';
import { DailyDigestService } from './daily-digest.service';
import { PendingDigestDocument } from './pending-digest.schema';

function createPendingDigestModelMock(
  create: jest.Mock = jest.fn().mockResolvedValue(undefined),
) {
  return { create } as unknown as Model<PendingDigestDocument>;
}

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
    const create = jest.fn().mockResolvedValue(undefined);
    const pendingDigestModel = createPendingDigestModelMock(create);
    const tomorrow = tomorrowIstanbul();
    const scheduledCall: ScheduledCallInput = {
      requestId: 'req-1',
      email: 'customer@example.com',
      scheduledAt: tomorrow.set({ hour: 10 }).toJSDate(),
      status: CallStatus.SCHEDULED,
    };
    const findScheduledBetween = jest.fn().mockResolvedValue([scheduledCall]);
    const repository = {
      findScheduledBetween,
    } as unknown as ScheduledCallRepository;
    const service = new DailyDigestService(
      repository,
      pendingDigestModel,
      createConfigServiceMock(),
    );

    await service.queueDailyDigest();

    expect(findScheduledBetween).toHaveBeenCalledWith(
      tomorrow.toJSDate(),
      tomorrow.plus({ days: 1 }).toJSDate(),
    );
    expect(create).toHaveBeenCalledWith({
      date: tomorrow.toISODate(),
      eventId: expect.any(String),
      payload: {
        adminEmail: 'admin@call-reservation.local',
        date: tomorrow.toISODate(),
        calls: [
          {
            requestId: 'req-1',
            email: 'customer@example.com',
            scheduledAt: scheduledCall.scheduledAt.toISOString(),
          },
        ],
      },
    });
  });

  it('still queues a digest with an empty calls list when nothing is scheduled', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const pendingDigestModel = createPendingDigestModelMock(create);
    const repository = {
      findScheduledBetween: jest.fn().mockResolvedValue([]),
    } as unknown as ScheduledCallRepository;
    const service = new DailyDigestService(
      repository,
      pendingDigestModel,
      createConfigServiceMock(),
    );

    await service.queueDailyDigest();

    const [{ payload }] = create.mock.calls[0];
    expect((payload as { calls: unknown[] }).calls).toEqual([]);
  });

  it('treats a duplicate-key error as "already queued" rather than a failure', async () => {
    const create = jest.fn().mockRejectedValue({ code: 11000 });
    const pendingDigestModel = createPendingDigestModelMock(create);
    const repository = {
      findScheduledBetween: jest.fn().mockResolvedValue([]),
    } as unknown as ScheduledCallRepository;
    const service = new DailyDigestService(
      repository,
      pendingDigestModel,
      createConfigServiceMock(),
    );

    await expect(service.queueDailyDigest()).resolves.toBeUndefined();
  });

  it('logs and swallows a genuine queue failure rather than crashing the scheduler', async () => {
    const create = jest.fn().mockRejectedValue(new Error('mongo down'));
    const pendingDigestModel = createPendingDigestModelMock(create);
    const repository = {
      findScheduledBetween: jest.fn().mockResolvedValue([]),
    } as unknown as ScheduledCallRepository;
    const service = new DailyDigestService(
      repository,
      pendingDigestModel,
      createConfigServiceMock(),
    );

    await expect(service.queueDailyDigest()).resolves.toBeUndefined();
  });
});
