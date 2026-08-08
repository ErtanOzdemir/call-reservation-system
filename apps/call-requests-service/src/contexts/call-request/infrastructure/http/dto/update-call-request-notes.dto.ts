import { UpdateCallRequestNotesPayload } from '@call-reservation/shared-types';
import { IsString, MaxLength } from 'class-validator';

export class UpdateCallRequestNotesDto implements UpdateCallRequestNotesPayload {
  @IsString()
  @MaxLength(2000)
  notes!: string;
}
