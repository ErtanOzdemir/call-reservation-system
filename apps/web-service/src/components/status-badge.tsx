import { CallStatus } from '@call-reservation/shared-types';

const STATUS_LABELS: Record<CallStatus, string> = {
  [CallStatus.REQUESTED]: 'Requested',
  [CallStatus.SCHEDULED]: 'Scheduled',
  [CallStatus.REJECTED]: 'Rejected',
  [CallStatus.CALLED]: 'Called',
  [CallStatus.CANCELED]: 'Canceled',
};

export function StatusBadge({ status }: { status: CallStatus }) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export default StatusBadge;
