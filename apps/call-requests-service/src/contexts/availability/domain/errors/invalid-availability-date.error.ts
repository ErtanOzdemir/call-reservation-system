export class InvalidAvailabilityDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = InvalidAvailabilityDateError.name;
  }
}
