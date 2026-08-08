import { CallRequestDto, CallStatus } from '@call-reservation/shared-types';
import { useEffect, useState } from 'react';
import { callRequestsApi } from '../api/call-requests-api';
import { Navbar } from '../components/navbar';
import { StatusBadge } from '../components/status-badge';
import { useAuth } from '../auth/auth-context';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminHomePage() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<CallRequestDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const loadRequests = () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError('');

    callRequestsApi
      .listAll(token)
      .then((list) => {
        setRequests(list);
        setNotesDraft(
          Object.fromEntries(list.map((item) => [item.id, item.notes ?? ''])),
        );
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load call requests.',
        );
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(loadRequests, [token]);

  if (!token) {
    return null;
  }

  const replaceRequest = (updated: CallRequestDto) => {
    setRequests((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  };

  const runAction = async (id: string, action: () => Promise<CallRequestDto>) => {
    setPendingActionId(id);
    setError('');

    try {
      const updated = await action();
      replaceRequest(updated);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'That action could not be completed.',
      );
    } finally {
      setPendingActionId(null);
    }
  };

  const saveNotes = (id: string) => {
    void runAction(id, () => callRequestsApi.setNotes(id, notesDraft[id] ?? '', token));
  };

  return (
    <div className="app-shell">
      <Navbar />
      <main className="workspace workspace-wide">
        <div className="workspace-header">
          <div>
            <h1>Admin dashboard</h1>
            <p className="workspace-intro">All call requests, newest slots first.</p>
          </div>
          <button
            className="button button-secondary"
            onClick={loadRequests}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error ? (
          <div className="notice notice-error" role="alert">
            {error}
          </div>
        ) : null}

        {!isLoading && requests.length === 0 ? (
          <p className="field-hint">No call requests yet.</p>
        ) : null}

        {requests.length > 0 ? (
          <div className="table-wrapper">
            <table className="requests-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Scheduled for</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => {
                  const isPending = pendingActionId === item.id;
                  const isDirty = (notesDraft[item.id] ?? '') !== (item.notes ?? '');

                  return (
                    <tr key={item.id}>
                      <td>
                        <div>{item.email}</div>
                        <div className="table-secondary">{item.phoneNumber}</div>
                      </td>
                      <td>{formatDateTime(item.scheduledAt)}</td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        <textarea
                          className="notes-textarea"
                          rows={2}
                          value={notesDraft[item.id] ?? ''}
                          onChange={(event) =>
                            setNotesDraft((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                        />
                        {isDirty ? (
                          <button
                            className="button button-secondary button-small"
                            disabled={isPending}
                            onClick={() => saveNotes(item.id)}
                          >
                            Save note
                          </button>
                        ) : null}
                      </td>
                      <td>
                        <div className="action-buttons">
                          {item.status === CallStatus.REQUESTED ? (
                            <>
                              <button
                                className="button button-primary button-small"
                                disabled={isPending}
                                onClick={() =>
                                  runAction(item.id, () =>
                                    callRequestsApi.approve(item.id, token),
                                  )
                                }
                              >
                                Approve
                              </button>
                              <button
                                className="button button-secondary button-small"
                                disabled={isPending}
                                onClick={() =>
                                  runAction(item.id, () =>
                                    callRequestsApi.reject(item.id, token),
                                  )
                                }
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                          {item.status === CallStatus.SCHEDULED ? (
                            <>
                              <button
                                className="button button-primary button-small"
                                disabled={isPending}
                                onClick={() =>
                                  runAction(item.id, () =>
                                    callRequestsApi.markCalled(item.id, token),
                                  )
                                }
                              >
                                Called
                              </button>
                              <button
                                className="button button-secondary button-small"
                                disabled={isPending}
                                onClick={() =>
                                  runAction(item.id, () =>
                                    callRequestsApi.cancel(item.id, token),
                                  )
                                }
                              >
                                Cancel
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default AdminHomePage;
