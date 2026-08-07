import { Role } from '@call-reservation/shared-types';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterUserDto } from './register-user.dto';

describe('RegisterUserDto', () => {
  it('normalizes an email before validating it', async () => {
    const payload = plainToInstance(RegisterUserDto, {
      email: ' Person@Example.COM ',
      password: 'password123',
      role: Role.USER,
    });

    await expect(validate(payload)).resolves.toHaveLength(0);
    expect(payload.email).toBe('person@example.com');
  });
});
