import { CallStatus } from '@call-reservation/shared-types';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema()
export class ReminderOutboxEventRecord {
  /** Own id so the dispatcher can $pull exactly this one once fired. */
  _id?: Types.ObjectId;

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

  /** Reminder wakeups awaiting delivery — written atomically with the rest of this document. */
  @Prop({ type: [ReminderOutboxEventSchema], default: [] })
  pendingReminders!: ReminderOutboxEventRecord[];
}

export type ScheduledCallDocument = HydratedDocument<ScheduledCallRecord>;
export const ScheduledCallSchema =
  SchemaFactory.createForClass(ScheduledCallRecord);
