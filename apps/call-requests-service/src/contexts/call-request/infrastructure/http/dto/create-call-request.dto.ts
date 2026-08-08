import { CreateCallRequestPayload } from '@call-reservation/shared-types';
import { Transform } from 'class-transformer';
import { IsEmail, IsISO8601, Matches } from 'class-validator';

export class CreateCallRequestDto implements CreateCallRequestPayload {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message:
      'phoneNumber must be a valid phone number in international format.',
  })
  phoneNumber!: string;

  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/, {
    message:
      'scheduledAt must include an explicit UTC offset (e.g. +03:00) or Z.',
  })
  scheduledAt!: string;
}
