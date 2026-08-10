import { Model } from 'mongoose';

type ChangeListener = (change: unknown) => void;

export interface ChangeStreamModelMock<TDocument> {
  model: Model<TDocument>;
  updateOne: jest.Mock;
  deleteOne: jest.Mock;
  changeStream: { on: jest.Mock; close: jest.Mock };
  emitChange: (change: unknown) => void;
}

export function createChangeStreamModelMock<TDocument>(
  seedRecords: unknown[],
): ChangeStreamModelMock<TDocument> {
  const changeStreamListeners: Record<string, ChangeListener> = {};
  const changeStream = {
    on: jest.fn((event: string, listener: ChangeListener) => {
      changeStreamListeners[event] = listener;
    }),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const find = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(seedRecords),
  });
  const updateOne = jest.fn().mockReturnValue({ exec: jest.fn() });
  const deleteOne = jest.fn().mockReturnValue({ exec: jest.fn() });
  const watch = jest.fn().mockReturnValue(changeStream);

  return {
    model: { find, updateOne, deleteOne, watch } as unknown as Model<TDocument>,
    updateOne,
    deleteOne,
    changeStream,
    emitChange: (change: unknown) => changeStreamListeners['change']?.(change),
  };
}
