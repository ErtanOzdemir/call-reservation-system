import { CallStatus } from '@call-reservation/shared-types';

export interface CallRequestProps {
  id?: string;
  email: string;
  phoneNumber: string;
  scheduledAt: Date;
  status: CallStatus;
  requestedByUserId: string;
  notes?: string;
  createdAt?: Date;
}

export class CallRequest {
  readonly id?: string;
  readonly email: string;
  readonly phoneNumber: string;
  readonly scheduledAt: Date;
  readonly durationMinutes = 30 as const;
  readonly status: CallStatus;
  readonly requestedByUserId: string;
  readonly notes?: string;
  readonly createdAt?: Date;

  constructor(props: CallRequestProps) {
    this.id = props.id;
    this.email = props.email;
    this.phoneNumber = props.phoneNumber;
    this.scheduledAt = props.scheduledAt;
    this.status = props.status;
    this.requestedByUserId = props.requestedByUserId;
    if (props.notes !== undefined) {
      this.notes = props.notes;
    }
    this.createdAt = props.createdAt;
  }

  withStatus(status: CallStatus): CallRequest {
    return new CallRequest({ ...this, status });
  }

  withNotes(notes: string): CallRequest {
    return new CallRequest({ ...this, notes });
  }
}
