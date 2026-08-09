export class ReserveCallUseCase {
  constructor(
    public readonly email: string,
    public readonly phoneNumber: string,
    public readonly scheduledAt: string,
    public readonly requestedByUserId: string,
  ) {}
}
