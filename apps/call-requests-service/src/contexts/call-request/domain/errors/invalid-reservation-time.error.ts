export class InvalidReservationTimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = InvalidReservationTimeError.name;
  }
}
