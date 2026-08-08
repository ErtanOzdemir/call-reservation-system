export class SlotUnavailableError extends Error {
  constructor() {
    super('The requested time slot is no longer available.');
    this.name = SlotUnavailableError.name;
  }
}
