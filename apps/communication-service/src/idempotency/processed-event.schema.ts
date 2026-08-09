import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * One document per outbox eventId this service has claimed. Existence of
 * the document is the claim: insert before doing the (non-idempotent) work,
 * delete it back out if that work fails so a redelivery can retry, leave it
 * in place once the work succeeds so a later redelivery is recognized as a
 * duplicate and skipped.
 */
@Schema({ collection: 'processed-events', timestamps: true })
export class ProcessedEventRecord {
  @Prop({ required: true, unique: true })
  eventId!: string;
}

export type ProcessedEventDocument = HydratedDocument<ProcessedEventRecord>;
export const ProcessedEventSchema = SchemaFactory.createForClass(
  ProcessedEventRecord,
);
