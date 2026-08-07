import { Role } from '@call-reservation/shared-types';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../domain/entities/user.entity';
import { UserAlreadyExistsError } from '../../domain/errors/user-already-exists.error';
import { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { UserDocument, UserRecord } from './user.schema';

@Injectable()
export class UserRepositoryAdapter implements UserRepositoryPort {
  constructor(
    @InjectModel(UserRecord.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.userModel.findOne({ email }).exec();

    return record ? this.toDomain(record) : null;
  }

  async save(user: User): Promise<User> {
    try {
      const record = await this.userModel.create({
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
      });

      return this.toDomain(record);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new UserAlreadyExistsError();
      }

      throw error;
    }
  }

  private toDomain(record: UserDocument): User {
    return new User(
      record._id.toString(),
      record.email,
      record.passwordHash,
      record.role as Role,
    );
  }

  private isDuplicateKeyError(error: unknown): error is { code: number } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }
}
