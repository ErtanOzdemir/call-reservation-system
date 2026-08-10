import { Model } from 'mongoose';
import { MongoProcessedEventRepository } from './mongo-processed-event-repository';
import { ProcessedEventDocument } from './processed-event.schema';

function createModelMock() {
  return {
    create: jest.fn(),
    deleteOne: jest.fn().mockReturnValue({ exec: jest.fn() }),
  };
}

describe('MongoProcessedEventRepository', () => {
  it('claims a new eventId and returns true', async () => {
    const model = createModelMock();
    model.create.mockResolvedValue(undefined);
    const repository = new MongoProcessedEventRepository(
      model as never as Model<ProcessedEventDocument>,
    );

    const claimed = await repository.claim('event-1');

    expect(claimed).toBe(true);
    expect(model.create).toHaveBeenCalledWith({ eventId: 'event-1' });
  });

  it('returns false for an eventId that was already claimed', async () => {
    const model = createModelMock();
    model.create.mockRejectedValue({ code: 11000 });
    const repository = new MongoProcessedEventRepository(
      model as never as Model<ProcessedEventDocument>,
    );

    const claimed = await repository.claim('event-1');

    expect(claimed).toBe(false);
  });

  it('rethrows a non-duplicate-key error', async () => {
    const model = createModelMock();
    model.create.mockRejectedValue(new Error('mongo down'));
    const repository = new MongoProcessedEventRepository(
      model as never as Model<ProcessedEventDocument>,
    );

    await expect(repository.claim('event-1')).rejects.toThrow('mongo down');
  });

  it('deletes the claim on release', async () => {
    const model = createModelMock();
    const repository = new MongoProcessedEventRepository(
      model as never as Model<ProcessedEventDocument>,
    );

    await repository.release('event-1');

    expect(model.deleteOne).toHaveBeenCalledWith({ eventId: 'event-1' });
  });
});
