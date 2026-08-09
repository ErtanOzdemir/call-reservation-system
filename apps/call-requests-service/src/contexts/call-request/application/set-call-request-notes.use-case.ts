export class SetCallRequestNotesUseCase {
  constructor(
    public readonly id: string,
    public readonly notes: string,
  ) {}
}
