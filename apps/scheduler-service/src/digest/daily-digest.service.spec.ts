import {
  CALL_EVENTS_EXCHANGE,
  CallStatus,
  RoutingKey,
} from '@call-reservation/shared-types';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { RabbitMqConnectionService } from '../shared-kernel/rabbitmq/rabbitmq-connection.service';
import {
  ScheduledCallInput,
  ScheduledCallRepository,
} from '../state/scheduled-call.repository';
import { DailyDigestService } from './daily-digest.service';

function createChannelMock() {
  return { publish: jest.fn() };
}

function createConfigServiceMock(): ConfigService {
  return {
    getOrThrow: jest.fn(() => 'admin@call-reservation.local'),
  } as unknown as ConfigService;
}

function tomorrowIstanbul(): DateTime {
  return DateTime.now().setZone('Europe/Istanbul').plus({ days: 1 }).startOf('day');
}

describe('DailyDigestService', () => {
  it('publishes digest.due with tomorrow\'s SCHEDULED calls, read from local state only', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
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
      rabbitMq,
      createConfigServiceMock(),
    );

    await service.publishDailyDigest();

    expect(findScheduledBetween).toHaveBeenCalledWith(
      tomorrow.toJSDate(),
      tomorrow.plus({ days: 1 }).toJSDate(),
    );
    expect(channel.publish).toHaveBeenCalledWith(
      CALL_EVENTS_EXCHANGE,
      RoutingKey.DigestDue,
      Buffer.from(
        JSON.stringify({
          adminEmail: 'admin@call-reservation.local',
          date: tomorrow.toISODate(),
          calls: [
            {
              requestId: 'req-1',
              email: 'customer@example.com',
              scheduledAt: scheduledCall.scheduledAt.toISOString(),
            },
          ],
        }),
      ),
      { contentType: 'application/json', persistent: true },
    );
  });

  it('still publishes a digest with an empty calls list when nothing is scheduled', async () => {
    const channel = createChannelMock();
    const rabbitMq = { channel } as unknown as RabbitMqConnectionService;
    const findScheduledBetween = jest.fn().mockResolvedValue([]);
    const repository = {
      findScheduledBetween,
    } as unknown as ScheduledCallRepository;
    const service = new DailyDigestService(
      repository,
      rabbitMq,
      createConfigServiceMock(),
    );

    await service.publishDailyDigest();

    const [, , payload] = channel.publish.mock.calls[0];
    expect(JSON.parse(payload.toString('utf8')).calls).toEqual([]);
  });
});
