import { CallStatus } from '@call-reservation/shared-types';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

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
}

export type ScheduledCallDocument = HydratedDocument<ScheduledCallRecord>;
export const ScheduledCallSchema =
  SchemaFactory.createForClass(ScheduledCallRecord);
