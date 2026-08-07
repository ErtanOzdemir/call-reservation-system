import { Role } from '@call-reservation/shared-types';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload } from '../../../domain/access-token-payload';
import { AuthenticatedRequest } from '../authenticated-request';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token);

      if (!this.isValidPayload(payload)) {
        throw new UnauthorizedException('Invalid or expired access token.');
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }

  private extractBearerToken(authorization: string | undefined): string | null {
    const [scheme, token, ...remainingParts] = authorization?.split(' ') ?? [];

    return scheme === 'Bearer' && token && remainingParts.length === 0
      ? token
      : null;
  }

  private isValidPayload(payload: AccessTokenPayload): boolean {
    return (
      typeof payload.sub === 'string' &&
      typeof payload.email === 'string' &&
      Object.values(Role).includes(payload.role)
    );
  }
}
