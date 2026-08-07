import { Role } from '@call-reservation/shared-types';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const request = { headers: {} } as {
    headers: { authorization?: string };
    user?: unknown;
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const jwtService = {
    verifyAsync: jest.fn(),
  } as unknown as JwtService;
  const guard = new JwtAuthGuard(jwtService);

  beforeEach(() => {
    jest.clearAllMocks();
    request.headers = {};
    delete request.user;
  });

  it('attaches verified token claims to the request', async () => {
    request.headers.authorization = 'Bearer signed-token';
    jest.mocked(jwtService.verifyAsync).mockResolvedValue({
      sub: 'user-id',
      email: 'person@example.com',
      role: Role.ADMIN,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'user-id',
      email: 'person@example.com',
      role: Role.ADMIN,
    });
  });

  it('rejects a missing bearer token', async () => {
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token that fails verification', async () => {
    request.headers.authorization = 'Bearer expired-token';
    jest.mocked(jwtService.verifyAsync).mockRejectedValue(new Error('expired'));

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
