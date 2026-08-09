export class LoginUseCase {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {}
}
