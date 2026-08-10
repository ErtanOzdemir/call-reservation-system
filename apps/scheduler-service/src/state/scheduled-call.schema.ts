import { CallStatus } from '@call-reservation/shared-types';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class ReminderOutboxEventRecord {
  /** Carried onto the wire with the wakeup — lets a consumer dedupe the
   * same logical reminder if it ever gets dispatched more than once. */
  @Prop({ required: true })
  eventId!: string;

  @Prop({ required: true })
  requestId!: string;

  /** When the wakeup should actually fire — not a delay, so a dispatcher
   * that only gets to it later still computes the right remaining wait. */
  @Prop({ required: true })
  targetFireAt!: Date;
}

export const ReminderOutboxEventSchema = SchemaFactory.createForClass(
  ReminderOutboxEventRecord,
);

@Schema({ collection: 'scheduled-calls', timestamps: true })
export class ScheduledCallRecord {
  @Prop({ required: true, unique: true, index: true })
  requestId!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email!: string;

  @Prop({ required: true, index: true })
  scheduledAt!: Date;

  @Prop({ required: true, enum: Object.values(CallStatus), type: String })
  status!: CallStatus;

  @Prop({ required: true, trim: true, lowercase: true })
  adminEmail!: string;

  /**
   * At most one pending reminder per request, ever — a single embedded
   * field (not an array) so re-processing a redelivered call.approved is a
   * $set (idempotent, overwrite) instead of a $push (would double the
   * pending reminder and eventually send it twice).
   */
  @Prop({ type: ReminderOutboxEventSchema, required: false })
  pendingReminder?: ReminderOutboxEventRecord;
}

export type ScheduledCallDocument = HydratedDocument<ScheduledCallRecord>;
export const ScheduledCallSchema =
  SchemaFactory.createForClass(ScheduledCallRecord);
