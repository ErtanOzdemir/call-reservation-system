import { RegisterUserPayload, Role } from '@call-reservation/shared-types';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsString, Length } from 'class-validator';

export class RegisterUserDto implements RegisterUserPayload {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 72)
  password!: string;

  @IsEnum(Role)
  role!: Role;
}
