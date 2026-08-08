import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CallRequest } from '../../domain/entities/call-request.entity';
import { OutboxEvent } from '../../domain/outbox-event';
import { CallRequestRepositoryPort } from '../../domain/ports/call-request-repository.port';
import { CallRequestDocument, CallRequestRecord } from './call-request.schema';

@Injectable()
export class CallRequestRepositoryAdapter implements CallRequestRepositoryPort {
  constructor(
    @InjectModel(CallRequestRecord.name)
    private readonly callRequestModel: Model<CallRequestDocument>,
  ) {}

  async hasConflictingRequest(scheduledAt: Date): Promise<boolean> {
    const existingRequest = await this.callRequestModel
      .exists({ scheduledAt })
      .exec();

    return existingRequest !== null;
  }

  async findById(id: string): Promise<CallRequest | null> {
    const record = await this.callRequestModel.findOne({ id }).exec();

    return record ? this.toDomain(record) : null;
  }

  async save(
    callRequest: CallRequest,
    event: OutboxEvent,
  ): Promise<CallRequest> {
    const record = await this.callRequestModel
      .findOneAndUpdate(
        { id: callRequest.id },
        {
          $set: {
            email: callRequest.email,
            phoneNumber: callRequest.phoneNumber,
            scheduledAt: callRequest.scheduledAt,
            status: callRequest.status,
            requestedByUserId: callRequest.requestedByUserId,
          },
          $push: {
            pendingEvents: {
              routingKey: event.routingKey,
              payload: event.payload,
              occurredAt: new Date(),
            },
          },
        },
        { upsert: true, new: true },
      )
      .exec();

    return this.toDomain(record);
  }

  private toDomain(record: CallRequestDocument): CallRequest {
    return new CallRequest({
      id: record.id,
      email: record.email,
      phoneNumber: record.phoneNumber,
      scheduledAt: record.scheduledAt,
      status: record.status,
      requestedByUserId: record.requestedByUserId,
      createdAt: record.createdAt,
    });
  }
}
