import { CallRequestResponse } from '@call-reservation/shared-types';
import { FormEvent, useEffect, useState } from 'react';
import { callRequestsApi } from '../api/call-requests-api';
import { ApiError } from '../api/api-client';
import { Navbar } from '../components/navbar';
import { StatusBadge } from '../components/status-badge';
import { useAuth } from '../auth/auth-context';

function tomorrowDateInputValue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

export function UserHomePage() {
  const { user, token } = useAuth();
  const [date, setDate] = useState(tomorrowDateInputValue());
  const [slots, setSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [booked, setBooked] = useState<CallRequestResponse | null>(null);
  const [myRequests, setMyRequests] = useState<CallRequestResponse[]>([]);
  const [isLoadingMine, setIsLoadingMine] = useState(true);
  const [mineError, setMineError] = useState('');

  const loadMyRequests = () => {
    if (!token) {
      return;
    }

    setIsLoadingMine(true);
    setMineError('');

    callRequestsApi
      .listMine(token)
      .then((list) => setMyRequests(list))
      .catch((error: unknown) => {
        setMineError(
          error instanceof Error ? error.message : 'Could not load your reservations.',
        );
      })
      .finally(() => setIsLoadingMine(false));
  };

  useEffect(loadMyRequests, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let isActive = true;
    setIsLoadingSlots(true);
    setSlotsError('');
    setSelectedSlot(null);

    callRequestsApi
      .getAvailability(date, token)
      .then((availability) => {
        if (isActive) {
          setSlots(availability.availableSlots);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setSlotsError(
            error instanceof Error ? error.message : 'Could not load availability.',
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingSlots(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [date, token]);

  if (!user || !token) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedSlot) {
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    try {
      const callRequest = await callRequestsApi.reserve(
        {
          email: user.email,
          phoneNumber,
          scheduledAt: selectedSlot,
        },
        token,
      );
      setBooked(callRequest);
      setSlots((current) => current.filter((slot) => slot !== selectedSlot));
      setSelectedSlot(null);
      loadMyRequests();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFormError('That slot was just taken. Please pick another one.');
        setSlots((current) => current.filter((slot) => slot !== selectedSlot));
        setSelectedSlot(null);
      } else {
        setFormError(
          error instanceof Error ? error.message : 'Could not book that slot.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <Navbar />
      <main className="workspace">
        <h1>User workspace</h1>
        <p className="workspace-intro">
          Pick an available 30-minute slot and reserve a call with the admin.
        </p>

        <section className="card">
          <h2>My reservations</h2>
          {isLoadingMine ? <p className="field-hint">Loading…</p> : null}
          {mineError ? (
            <div className="notice notice-error" role="alert">
              {mineError}
            </div>
          ) : null}
          {!isLoadingMine && !mineError && myRequests.length === 0 ? (
            <p className="field-hint">You haven't requested any calls yet.</p>
          ) : null}
          {myRequests.length > 0 ? (
            <ul className="my-requests-list">
              {myRequests.map((item) => (
                <li key={item.id} className="my-requests-item">
                  <span>{formatDateTime(item.scheduledAt)}</span>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {booked ? (
          <div className="notice notice-success" role="status">
            Booked! Your call is requested for {formatSlot(booked.scheduledAt)}.
            You'll get an email once the admin reviews it.
          </div>
        ) : null}

        <section className="card">
          <h2>Availability</h2>
          <label className="field">
            Date
            <input
              type="date"
              min={tomorrowDateInputValue()}
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setBooked(null);
              }}
            />
          </label>

          {isLoadingSlots ? <p className="field-hint">Loading slots…</p> : null}
          {slotsError ? (
            <div className="notice notice-error" role="alert">
              {slotsError}
            </div>
          ) : null}
          {!isLoadingSlots && !slotsError && slots.length === 0 ? (
            <p className="field-hint">
              No slots available on this day — try another date.
            </p>
          ) : null}

          {slots.length > 0 ? (
            <div className="slot-grid">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={
                    slot === selectedSlot
                      ? 'slot-button slot-button-selected'
                      : 'slot-button'
                  }
                  onClick={() => setSelectedSlot(slot)}
                >
                  {formatSlot(slot)}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {selectedSlot ? (
          <section className="card">
            <h2>Reserve {formatSlot(selectedSlot)}</h2>
            {formError ? (
              <div className="notice notice-error" role="alert">
                {formError}
              </div>
            ) : null}
            <form className="auth-form" onSubmit={handleSubmit}>
              <label>
                Email address
                <input type="email" value={user.email} disabled />
              </label>
              <label>
                Phone number
                <input
                  type="tel"
                  placeholder="+905551234567"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  required
                />
              </label>
              <button className="button button-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Booking…' : 'Confirm reservation'}
              </button>
            </form>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default UserHomePage;
