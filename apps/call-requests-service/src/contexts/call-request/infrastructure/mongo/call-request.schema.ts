import { CallStatus } from '@call-reservation/shared-types';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema()
export class OutboxEventRecord {
  /** Own id so the dispatcher can $pull exactly this event once delivered. */
  _id?: Types.ObjectId;

  @Prop({ required: true })
  routingKey!: string;

  @Prop({ required: true, type: Object })
  payload!: Record<string, unknown>;

  @Prop({ required: true })
  occurredAt!: Date;
}

export const OutboxEventSchema =
  SchemaFactory.createForClass(OutboxEventRecord);

@Schema({ collection: 'call-requests', timestamps: true })
export class CallRequestRecord {
  @Prop({ required: true, unique: true, index: true })
  id!: string;

  @Prop({ required: true, trim: true, lowercase: true, index: true })
  email!: string;

  @Prop({ required: true, trim: true })
  phoneNumber!: string;

  @Prop({ required: true, index: true })
  scheduledAt!: Date;

  @Prop({ required: true, enum: Object.values(CallStatus), type: String })
  status!: CallStatus;

  @Prop({ required: true })
  requestedByUserId!: string;

  @Prop({ required: false, trim: true })
  notes?: string;

  /** Events awaiting delivery to RabbitMQ — written atomically with the rest of this document. */
  @Prop({ type: [OutboxEventSchema], default: [] })
  pendingEvents!: OutboxEventRecord[];

  createdAt?: Date;
}

export type CallRequestDocument = HydratedDocument<CallRequestRecord>;
export const CallRequestSchema =
  SchemaFactory.createForClass(CallRequestRecord);


CallRequestSchema.index(
  { scheduledAt: 1 },
  {
    name: 'unique_active_scheduled_at',
    unique: true,
    partialFilterExpression: {
      status: { $in: [CallStatus.REQUESTED, CallStatus.SCHEDULED] },
    },
  },
);
