import { Role, isMongoDuplicateKeyError } from '@call-reservation/shared-types';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../domain/entities/user.entity';
import { AdminAlreadyExistsError } from '../../domain/errors/admin-already-exists.error';
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

  async existsByRole(role: Role): Promise<boolean> {
    const existing = await this.userModel.exists({ role }).exec();

    return existing !== null;
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
      if (isMongoDuplicateKeyError(error)) {
        if (this.isAdminRoleConflict(error)) {
          throw new AdminAlreadyExistsError();
        }

        throw new UserAlreadyExistsError();
      }

      throw error;
    }
  }

  /** The unique index doing the rejecting — email or the single-admin
   * role constraint — is named in the duplicate-key error's keyPattern. */
  private isAdminRoleConflict(error: unknown): boolean {
    const keyPattern = (error as { keyPattern?: Record<string, unknown> })
      .keyPattern;

    return keyPattern != null && 'role' in keyPattern;
  }

  private toDomain(record: UserDocument): User {
    return new User(
      record._id.toString(),
      record.email,
      record.passwordHash,
      record.role as Role,
    );
  }
}
