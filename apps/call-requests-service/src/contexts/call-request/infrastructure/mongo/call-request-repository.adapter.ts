import {
  CallLifecyclePolicy,
  CallStatus,
  isMongoDuplicateKeyError,
} from '@call-reservation/shared-types';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CallRequest } from '../../domain/entities/call-request.entity';
import { SlotUnavailableError } from '../../domain/errors/slot-unavailable.error';
import { OutboxEvent } from '../../domain/outbox-event';
import { CallRequestRepositoryPort } from '../../domain/ports/call-request-repository.port';
import { CallRequestDocument, CallRequestRecord } from './call-request.schema';

@Injectable()
export class CallRequestRepositoryAdapter implements CallRequestRepositoryPort {
  constructor(
    @InjectModel(CallRequestRecord.name)
    private readonly callRequestModel: Model<CallRequestDocument>,
  ) {}

  /**
   * Only REQUESTED/SCHEDULED requests actually hold the slot — a
   * REJECTED/CANCELED one must free it back up for re-booking.
   */
  async hasConflictingRequest(scheduledAt: Date): Promise<boolean> {
    const existingRequest = await this.callRequestModel
      .exists({
        scheduledAt,
        status: { $in: CallLifecyclePolicy.ACTIVE_STATUSES },
      })
      .exec();

    return existingRequest !== null;
  }

  async findById(id: string): Promise<CallRequest | null> {
    const record = await this.callRequestModel.findOne({ id }).exec();

    return record ? this.toDomain(record) : null;
  }

  /**
   * The `hasConflictingRequest` pre-check narrows the odds but can't close
   * the race on its own (two concurrent reserves can both pass it before
   * either write lands) — the partial unique index on scheduledAt is the
   * actual guard, and a duplicate-key error here means the other request
   * won that race.
   */
  async create(
    callRequest: CallRequest,
    event: OutboxEvent,
  ): Promise<CallRequest> {
    try {
      const record = await this.callRequestModel.create({
        id: callRequest.id,
        email: callRequest.email,
        phoneNumber: callRequest.phoneNumber,
        scheduledAt: callRequest.scheduledAt,
        status: callRequest.status,
        requestedByUserId: callRequest.requestedByUserId,
        pendingEvents: [
          {
            eventId: event.eventId,
            routingKey: event.routingKey,
            payload: event.payload,
            occurredAt: new Date(),
          },
        ],
      });

      return this.toDomain(record);
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw new SlotUnavailableError();
      }

      throw error;
    }
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
                eventId: event.eventId,
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

  async findAll(): Promise<CallRequest[]> {
    const records = await this.callRequestModel
      .find()
      .sort({ scheduledAt: 1 })
      .exec();

    return records.map((record) => this.toDomain(record));
  }

  async findByRequestedByUserId(
    requestedByUserId: string,
  ): Promise<CallRequest[]> {
    const records = await this.callRequestModel
      .find({ requestedByUserId })
      .sort({ scheduledAt: 1 })
      .exec();

    return records.map((record) => this.toDomain(record));
  }

  async setNotes(id: string, notes: string): Promise<CallRequest | null> {
    const record = await this.callRequestModel
      .findOneAndUpdate(
        { id },
        { $set: { notes } },
        { upsert: false, new: true },
      )
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
