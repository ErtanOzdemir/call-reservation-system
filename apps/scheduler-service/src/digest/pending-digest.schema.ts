import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * One document per not-yet-published daily digest. `date` is unique so a
 * cron that somehow fires twice for the same day can't queue it twice —
 * the second insert just fails with a duplicate-key error, which the
 * writer treats as "already queued, fine".
 */
@Schema({ collection: 'pending-digests', timestamps: true })
export class PendingDigestRecord {
  @Prop({ required: true, unique: true, index: true })
  date!: string;

  /** Carried onto the wire with the payload — lets a consumer dedupe the
   * same logical digest if it ever gets dispatched more than once. */
  @Prop({ required: true })
  eventId!: string;

  @Prop({ required: true, type: Object })
  payload!: Record<string, unknown>;
}

export type PendingDigestDocument = HydratedDocument<PendingDigestRecord>;
export const PendingDigestSchema =
  SchemaFactory.createForClass(PendingDigestRecord);
