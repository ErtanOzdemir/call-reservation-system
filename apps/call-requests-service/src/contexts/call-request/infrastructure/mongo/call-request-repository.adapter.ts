import { CallStatus } from '@call-reservation/shared-types';
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

  async create(
    callRequest: CallRequest,
    event: OutboxEvent,
  ): Promise<CallRequest> {
    const record = await this.callRequestModel.create({
      id: callRequest.id,
      email: callRequest.email,
      phoneNumber: callRequest.phoneNumber,
      scheduledAt: callRequest.scheduledAt,
      status: callRequest.status,
      requestedByUserId: callRequest.requestedByUserId,
      pendingEvents: [
        {
          routingKey: event.routingKey,
          payload: event.payload,
          occurredAt: new Date(),
        },
      ],
    });

    return this.toDomain(record);
  }

  /**
   * `status: expectedCurrentStatus` in the filter is the whole guard: if
   * another request already moved this document past that status, nothing
   * matches, upsert is off, and this resolves to null instead of silently
   * creating a stray document or double-applying the transition.
   */
  async transition(
    callRequest: CallRequest,
    expectedCurrentStatus: CallStatus,
    event?: OutboxEvent,
  ): Promise<CallRequest | null> {
    const record = await this.callRequestModel
      .findOneAndUpdate(
        { id: callRequest.id, status: expectedCurrentStatus },
        {
          $set: {
            email: callRequest.email,
            phoneNumber: callRequest.phoneNumber,
            scheduledAt: callRequest.scheduledAt,
            status: callRequest.status,
            requestedByUserId: callRequest.requestedByUserId,
          },
          ...(event && {
            $push: {
              pendingEvents: {
                routingKey: event.routingKey,
                payload: event.payload,
                occurredAt: new Date(),
              },
            },
          }),
        },
        { upsert: false, new: true },
      )
      .exec();

    return record ? this.toDomain(record) : null;
  }

  async setNotes(id: string, notes: string): Promise<CallRequest | null> {
    const record = await this.callRequestModel
      .findOneAndUpdate({ id }, { $set: { notes } }, { upsert: false, new: true })
      .exec();

    return record ? this.toDomain(record) : null;
  }

  private toDomain(record: CallRequestDocument): CallRequest {
    return new CallRequest({
      id: record.id,
      email: record.email,
      phoneNumber: record.phoneNumber,
      scheduledAt: record.scheduledAt,
      status: record.status,
      requestedByUserId: record.requestedByUserId,
      notes: record.notes,
      createdAt: record.createdAt,
    });
  }
}
