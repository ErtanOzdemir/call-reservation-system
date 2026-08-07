import { AuthenticatedUserDto } from '@call-reservation/shared-types';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUserDto;
}
