import { Model } from 'mongoose';
import { ProcessedEventDocument } from './processed-event.schema';
import { ProcessedEventRepository } from './processed-event.repository';

function createModelMock() {
  return {
    create: jest.fn(),
    deleteOne: jest.fn().mockReturnValue({ exec: jest.fn() }),
  };
}

describe('ProcessedEventRepository', () => {
  it('claims a new eventId and returns true', async () => {
    const model = createModelMock();
    model.create.mockResolvedValue(undefined);
    const repository = new ProcessedEventRepository(
      model as never as Model<ProcessedEventDocument>,
    );

    const claimed = await repository.claim('event-1');

    expect(claimed).toBe(true);
    expect(model.create).toHaveBeenCalledWith({ eventId: 'event-1' });
  });

  it('returns false for an eventId that was already claimed', async () => {
    const model = createModelMock();
    model.create.mockRejectedValue({ code: 11000 });
    const repository = new ProcessedEventRepository(
      model as never as Model<ProcessedEventDocument>,
    );

    const claimed = await repository.claim('event-1');

    expect(claimed).toBe(false);
  });

  it('rethrows a non-duplicate-key error', async () => {
    const model = createModelMock();
    model.create.mockRejectedValue(new Error('mongo down'));
    const repository = new ProcessedEventRepository(
      model as never as Model<ProcessedEventDocument>,
    );

    await expect(repository.claim('event-1')).rejects.toThrow('mongo down');
  });

  it('deletes the claim on release', async () => {
    const model = createModelMock();
    const repository = new ProcessedEventRepository(
      model as never as Model<ProcessedEventDocument>,
    );

    await repository.release('event-1');

    expect(model.deleteOne).toHaveBeenCalledWith({ eventId: 'event-1' });
  });
});
