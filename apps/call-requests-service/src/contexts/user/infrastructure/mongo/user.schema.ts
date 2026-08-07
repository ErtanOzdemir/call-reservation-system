import { Role } from '@call-reservation/shared-types';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'users', timestamps: true })
export class UserRecord {
  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    lowercase: true,
  })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true, enum: Object.values(Role), type: String })
  role!: Role;
}

export type UserDocument = HydratedDocument<UserRecord>;
export const UserSchema = SchemaFactory.createForClass(UserRecord);
