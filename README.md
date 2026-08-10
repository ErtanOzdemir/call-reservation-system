# Call Reservation System

Backend for booking a 30-minute call with an admin, implemented as three
NestJS services plus a React frontend, communicating over MongoDB and
RabbitMQ. This document covers
how to run the project, how it is structured, and the assumptions and
decisions made during implementation.

## Tech stack

- **Workspace:** Nx monorepo
- **Backend:** NestJS (3 independent applications)
- **Database:** MongoDB (one logical database per owning service)
- **Message broker:** RabbitMQ (topic exchange + delayed-message plugin)
- **Frontend:** React (Vite), calls `call-requests-service` only
- **Infrastructure:** Docker & Docker Compose

## High-level architecture

The frontend only calls Call Requests Service. Scheduler Service and
Communication Service do not call Call Requests Service's API and do not
share its database; they receive state changes as RabbitMQ events on the
`call.events` exchange. This is required by the assignment, which prohibits
polling between services.

```mermaid
flowchart LR
    FE["Web Frontend<br/>User view · Admin view"] -->|REST| CRS
    CRS["Call Requests Service<br/>REST API · source of truth<br/>working-hours & validation logic"] -->|reads / writes| MDB[("MongoDB<br/>call_requests db")]
    CRS -.->|"outbox write<br/>(same doc, same tx)"| Relay1["Outbox Dispatcher #1<br/>change-stream relay"]
    Relay1 -->|publish| MQ{{"RabbitMQ<br/>call.events topic exchange"}}

    MQ -->|"call.requested<br/>call.approved<br/>call.rejected<br/>call.canceled"| COM
    MQ -->|"call.approved<br/>call.canceled"| SCH

    SCH["Scheduler Service<br/>only cron/interval owner"] -->|"own write:<br/>pendingReminder"| SDB[("MongoDB<br/>scheduler_state db")]
    SDB -.->|"change stream"| Relay2["Outbox Dispatcher #2<br/>Scheduler's reminder relay"]
    Relay2 -->|"publish (delayed,<br/>x-delay header)"| DMQ{{"RabbitMQ<br/>reminder.delay exchange"}}
    DMQ -->|"delivered back once<br/>the delay elapses"| SCH
    SCH -.->|"re-check state, then publish"| MQ

    SCH -->|"daily cron: write<br/>pending-digests doc"| SDB
    SDB -.->|"change stream"| Relay3["Outbox Dispatcher #3<br/>Scheduler's digest relay"]
    Relay3 -->|publish| MQ

    MQ -->|"reminder.due<br/>digest.due"| COM

    COM["Communication Service<br/>sender of email<br/>templates + SMTP<br/>dedupes by eventId"] -->|"claim / release<br/>by eventId"| CDB[("MongoDB<br/>communication db")]
    COM --> MH[["MailHog<br/>mock inbox"]]
```

Notes on the diagram:

- Call Requests Service does not publish to RabbitMQ directly. It writes the
  state change and the outbox event in one atomic Mongo write. Outbox
  Dispatcher #1 (`OutboxDispatcherService`) is a separate process inside the
  same service that tails that collection's MongoDB change stream and
  publishes to RabbitMQ when it sees a matching write.
- The four lifecycle events — `call.requested`, `call.approved`,
  `call.rejected`, `call.canceled` — are consumed by Communication Service
  directly from the exchange. They are not routed through Scheduler.
  Communication Service binds its own queue to these routing keys because it
  only needs to react to the event, not hold any state.
- Scheduler binds to a narrower set of routing keys — `call.approved`,
  `call.canceled` — which is what it needs to build its own local state.
  It does not bind `call.requested` or `call.rejected`: a request that's
  still pending, or was rejected, was never scheduled and needs no reminder
  or digest entry, so there's nothing for Scheduler to do with either event.
  `handleCallApproved`'s `upsert(..., {upsert:true})` creates Scheduler's
  local document from scratch on approval — it doesn't depend on an earlier
  `call.requested` write.
- Scheduler also runs its own outbox dispatcher (`ReminderOutboxDispatcherService`,
  Outbox Dispatcher #2 above), independent from Call Requests Service's. When
  it consumes `call.approved`, it writes `pendingReminder{ targetFireAt }`
  onto its own document in its own database. Its own change-stream relay
  picks that write up and publishes it to the `reminder.delay` exchange with
  the remaining delay set as an `x-delay` header. When the delay elapses,
  RabbitMQ delivers the message back to Scheduler
  (`ReminderWakeupConsumer`), which checks that the call is still
  `SCHEDULED` (it may have been canceled in the meantime) and only then
  publishes `reminder.due` onto `call.events`.
- `digest.due` goes through a third, dedicated outbox
  (`DigestOutboxDispatcherService`, Outbox Dispatcher #3 above). The daily
  cron (`DailyDigestService`) only computes tomorrow's calls and writes one
  document to a `pending-digests` collection — it never talks to RabbitMQ
  itself. The dispatcher tails that collection's change stream the same way
  the other two do, publishes, then deletes the document. This means a
  RabbitMQ outage (or the process dying) at exactly 18:00 no longer loses
  that day's digest outright: it sits in `pending-digests` until the next
  catch-up sweep — on the next restart, or as soon as the broker is back —
  delivers it. Earlier versions of this service published directly from the
  cron job with a few immediate retries and no persistence; that meant a
  broker outage spanning the retry window silently dropped the digest until
  the next day.
- Every event on the diagram carries an `eventId` (a `randomUUID()`, minted
  wherever that event is first written to an outbox — it is not part of the
  event's own TypeScript type, it's merged onto the JSON payload at publish
  time). `reminder.due` is the one exception worth calling out: rather than
  minting its own, it reuses `reminder.wakeup`'s `eventId` — see
  [`reminder-wakeup.consumer.ts`](apps/scheduler-service/src/consumers/reminder-wakeup.consumer.ts)
  — so that a redelivered wakeup still produces a `reminder.due` Communication
  Service can recognize as the same event. Communication Service is the only
  consumer that uses `eventId`: see "Communication Service dedupes emails by
  eventId" below.

## Why hexagonal architecture — only in Call Requests Service

`call-requests-service` is the one service with business rules worth
isolating from infrastructure: working-hours validation, slot-conflict
checks, the call lifecycle state machine, and auth. It is implemented with
ports & adapters (hexagonal architecture):

```mermaid
flowchart LR
    HTTP["HTTP Controller<br/>DTO + validation"] -->|calls| Core
    Core["Domain Core<br/>use cases · policies<br/>no Mongo/RabbitMQ imports"] -->|via ports| Mongo["Mongo Adapter<br/>implements both ports"]
    Mongo -->|single atomic write| Doc[("reservation + outbox event<br/>in ONE document")]
    Doc -->|change stream| Relay["Outbox Dispatcher<br/>tails the change stream"]
    Relay -->|publish| Exchange{{"call.events exchange"}}
```

The domain core (use cases, entities, policies) does not import Mongo,
Mongoose, or amqplib; it depends only on plain TypeScript ports (interfaces).
The infrastructure layer implements those ports as adapters (HTTP
controllers, a Mongo repository, an outbox dispatcher). In practice this
means: each use case is isolated behind its own port, business rules can be
unit-tested with an in-memory repository with no framework or database
dependency, and replacing Mongo would only touch the `infrastructure/`
folder.

For background on this pattern:
[Hexagonal Architecture — Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/).

`scheduler-service` and `communication-service` stay as plain NestJS modules
— no ports, no domain/infrastructure split. Neither has business logic
complex enough to justify the extra layer: Scheduler's job is to hold local
state and know when to fire an event; Communication Service's job is to map
an event to a template and send it. Adding a hexagonal core to either would
add indirection without a corresponding benefit, which is the reason
`call-requests-service` uses this structure and the other two don't.

## No polling: how Scheduler learns about the future

The assignment requires that `scheduler-service` be the only service running
cron jobs or intervals, and that services not poll each other for updates.
Two mechanisms are used to satisfy this.

1. **Outbox relayed by MongoDB change streams, not a poller.** Each service
   that needs to publish an event does so by writing the event into Mongo
   first, then a dispatcher tails a change stream and publishes to RabbitMQ
   when it sees a matching write, clearing the pending record afterward.
   Three independent instances of this run across the two services — see
   "Outbox Dispatcher #1/#2/#3" in the diagram above:
   - Call Requests Service: `pendingEvents` embedded on `CallRequestRecord`,
     in the same atomic write as the state change it describes.
   - Scheduler (reminders): `pendingReminder` embedded on
     `ScheduledCallRecord`, written when `call.approved` is consumed.
   - Scheduler (digest): a standalone `pending-digests` collection, one
     document per not-yet-delivered day, written by the daily cron.

   If a process crashes between the state write and the publish, the
   pending record is picked up on the next change-stream catch-up sweep at
   startup; state and event cannot go out of sync because — for the first
   two — they were written together in one document.

   The outbox event is embedded in the same document instead of living in a
   separate `outbox` collection. A dedicated outbox collection is the more
   common approach and would still get the same atomicity through a Mongo
   transaction, but for a document with a single writer, embedding avoids an
   extra collection and a transaction without adding anything.

2. **Delayed exchange instead of a sweep job for reminders.** When a call is
   approved, the 2-hour-before reminder delay is computed once, at approval
   time, and the message is handed to RabbitMQ's `x-delayed-message`
   exchange (`reminder.delay`). RabbitMQ holds the message and releases it
   when the delay elapses; Scheduler does not run a periodic check for due
   reminders. The only cron job in the system is the once-a-day digest
   (`DailyDigestService`, `@Cron('0 18 * * *')`), which is a genuinely
   time-based trigger rather than a check for changed state.

## Call lifecycle & email notifications

```mermaid
stateDiagram-v2
    [*] --> REQUESTED: user submits time + email + phone
    REQUESTED --> SCHEDULED: admin approves
    REQUESTED --> REJECTED: admin rejects
    SCHEDULED --> CALLED: admin marks called
    SCHEDULED --> CANCELED: admin cancels
```

| Trigger | Routing key | Recipient(s) | Purpose |
|---|---|---|---|
| User submits a request | `call.requested` | Customer | Confirms the request was received |
| Admin approves | `call.approved` | Customer | Confirms approval, notes a reminder will follow |
| Admin rejects | `call.rejected` | Customer | Notifies rejection, suggests booking another time |
| Admin cancels a scheduled call | `call.canceled` | Customer | Notifies cancellation |
| 2 hours before the call | `reminder.due` (delayed exchange, scheduled once at approval time) | Customer and Admin | Two emails, one per recipient |
| Daily at 18:00 Europe/Istanbul | `digest.due` | Admin | One email listing every call scheduled for the next day |
| Admin marks a call as Called | — | — | Internal status change only; not part of the assignment's email list, so no email is sent |

Communication Service is the only service that sends email. It holds every
template and contains no business logic beyond mapping a routing key to a
rendered message. See `apps/communication-service/src/templates/`.

## Assumptions & architectural decisions

- **Outbox pattern instead of publishing directly from application code.**
  Writing to MongoDB and then separately calling `rabbitMq.publish(...)` has a
  dual-write problem: if the process crashes, or RabbitMQ is briefly
  unreachable, between the two calls, the state change and the event it
  should have triggered can permanently diverge — a call gets approved in the
  database but `call.approved` never reaches Scheduler or Communication
  Service, with nothing left to detect the gap. This system avoids that by
  never publishing directly from application code: every event is first
  written into MongoDB in the same atomic write as the state change it
  describes (see "No polling" above for the mechanics — `pendingEvents`,
  `pendingReminder`, `pending-digests`), and a separate dispatcher process
  tails that collection's change stream, publishes to RabbitMQ, and only then
  clears the record. A crash at any point before that last step is recovered
  by the dispatcher's startup catch-up sweep, so at-least-once delivery is
  guaranteed without needing a two-phase commit across MongoDB and RabbitMQ.

  **Bonus / possible improvement — a Dead Letter Queue was intentionally left
  out.** Right now a message a consumer keeps failing to process is nacked
  and requeued indefinitely (`channel.nack(message, false, true)`), so a
  persistently broken message — a malformed payload, a bug in one handler —
  would loop forever instead of being set aside. A Dead Letter
  Exchange/Queue, routing a message to a separate queue after N failed
  delivery attempts, is the standard fix for this: it gives an operator
  somewhere to see and replay stuck messages instead of them looping
  silently. It was left out here to keep the messaging topology (exchanges,
  queues, bindings) as small as this assignment's scope needed — adding it
  would mean per-queue retry-count tracking and a second exchange per queue,
  which felt like unnecessary complexity for a project this size.

- **30-minute fixed slots.** Users select a start time from a list of
  pre-computed 30-minute slots (10:00, 10:30, … up to 17:30) instead of
  entering an arbitrary time. This is what `GET /availability` returns, and
  `WorkingHoursPolicy` re-validates it server-side regardless of what the
  client sends. Working hours are 10:00–18:00 Istanbul time, Monday–Friday;
  past dates and same-day bookings are rejected.

- **Double-booking is prevented at the database level, not just in
  application code.** The initial implementation only checked for a
  conflicting request before inserting a new one — two requests for the
  same slot arriving close together could both pass that check before
  either write landed. `CallRequestRecord` now has a partial unique index
  on `scheduledAt`, scoped to `status: REQUESTED | SCHEDULED` (a
  `REJECTED`/`CANCELED`/`CALLED` request frees the slot back up for
  re-booking). A losing concurrent insert now fails with a Mongo duplicate-key
  error, which the repository adapter turns into the same `SlotUnavailableError`
  (409) the pre-check already produced for the non-concurrent case.

- **Single admin, via `ADMIN_EMAIL`.** All admin-facing emails (reminders,
  daily digest) go to one address, configured with the `ADMIN_EMAIL`
  environment variable. A system with multiple admins could broadcast the
  initial `call.requested` notification to every admin, then route
  subsequent reminders and digests only to whichever admin approved the
  request. That requires request-to-admin ownership, notification
  preferences, and handling for edge cases (an admin leaving, reassignment,
  etc.), which is out of scope for this assignment; the implementation sends
  everything to the single address in `ADMIN_EMAIL`. This is noted with a
  comment at the point where the admin email is attached to an event, in
  [`apps/scheduler-service/src/consumers/reminder-wakeup.consumer.ts`](apps/scheduler-service/src/consumers/reminder-wakeup.consumer.ts)
  and
  [`apps/scheduler-service/src/digest/daily-digest.service.ts`](apps/scheduler-service/src/digest/daily-digest.service.ts).

- **Reminder timing: 2 hours before, to both parties.** The assignment
  document is inconsistent on this point: the call-lifecycle table states
  the reminder fires "exactly 2 hours before" the call, while the
  email-notification list separately states "30 minutes to call, notify both
  customer and admin." The most likely reading is that the "30 minutes"
  figure refers to the call's duration, not a second reminder timed
  independently of the first. Rather than implement a second reminder the
  rest of the document does not otherwise describe, this implementation
  sends a single reminder, 2 hours before the call, to both the customer and
  the admin, which satisfies both the explicit 2-hour requirement and the
  "notify both customer and admin" requirement.

- **Emails are sent through a real SMTP transport (MailHog), not only
  logged.** The assignment states that a `console.log` of the template and
  recipient is sufficient, and Communication Service does log every send
  (with the recipient partially masked). It additionally sends the message
  through `nodemailer` to MailHog, a disposable SMTP catcher with a web UI,
  so the email content can be inspected as a rendered message (from, to,
  subject, body) rather than only a log line. MailHog runs in the same
  Docker Compose stack, so this adds no extra setup.

- **Communication Service dedupes emails by `eventId`.** Every other
  consumer in this system (Scheduler's `upsert(requestId, ...)`) is
  naturally idempotent under RabbitMQ's at-least-once redelivery, because
  its side effect is overwriting state — replaying the same event twice
  produces the same document either way. Sending an email has no such
  natural idempotency: replaying the same event twice sends the email
  twice. `CallEventsConsumer` ([`apps/communication-service/src/consumers/call-events.consumer.ts`](apps/communication-service/src/consumers/call-events.consumer.ts))
  reads the wire-level `eventId` off the incoming payload and claims it in a
  `processed-events` Mongo collection (`eventId` unique index) *before*
  rendering/sending — a claim that fails with a duplicate-key error means
  this event was already handled, so the message is acked without sending
  anything again. If sending fails after a successful claim, the claim is
  released so the inevitable redelivery can actually retry instead of being
  skipped as a false duplicate for an email that never went out. This also
  closes a gap that existed before Scheduler even had an `eventId` to
  forward: `reminder.due` didn't carry one at all. It now reuses the
  `eventId` off the `reminder.wakeup` message that triggered it
  ([`apps/scheduler-service/src/consumers/reminder-wakeup.consumer.ts`](apps/scheduler-service/src/consumers/reminder-wakeup.consumer.ts))
  rather than minting a fresh one per publish — a redelivered wakeup (the
  broker's at-least-once guarantee, e.g. the process dying after a
  successful publish but before the ack lands) reprocesses from scratch and
  would otherwise produce a second `reminder.due` with a different `eventId`,
  invisible to Communication Service's dedup check. Reusing the id closes
  that hole: both publishes carry the same `eventId`, so the second is
  correctly recognized as a duplicate and skipped.

## Folder structure

```
call-reservation-system/
├── apps/
│   ├── call-requests-service/   # REST API · source of truth · hexagonal core + outbox publisher
│   ├── scheduler-service/       # only cron/interval owner · delayed-exchange consumer
│   ├── communication-service/   # email templates · SMTP sender · terminal consumer
│   └── web-service/             # React frontend (User view / Admin view)
├── libs/
│   └── shared-types/            # DTOs, enums, and event-payload contracts shared by every app
├── scripts/
│   ├── docker-compose.yml       # base service definitions
│   ├── docker-compose.dev.yml   # local port-mapping overlay
│   ├── mongodb/                 # replica-set init script (required for Mongo change streams)
│   ├── rabbitmq/                # Dockerfile with the delayed-message plugin baked in
│   ├── services/Dockerfile      # shared multi-stage build for the 3 NestJS apps
│   └── web-service/             # nginx + Dockerfile for the frontend
└── README.md
```

### Inside `call-requests-service` — ports & adapters

```
call-requests-service/src/
├── main.ts
├── app/app.module.ts               # composes the 4 context modules below
├── config/                         # env validation (zod)
├── shared-kernel/                  # technical plumbing, no business rules
│   ├── mongo-connection.module.ts
│   └── rabbitmq/                   # publish-with-confirm + retry
└── contexts/
    ├── user/                       # bounded context — identity: who this person is
    │   ├── domain/                 # entities, value objects
    │   ├── application/            # use cases
    │   └── infrastructure/         # http controller, Mongo schema + repository
    ├── auth/                       # bounded context — login mechanics only, no entity of its own
    │   ├── domain/ports/           # token-issuer port
    │   └── infrastructure/         # controller, JWT guard, roles guard
    ├── call-request/               # bounded context — the aggregate + its lifecycle
    │   ├── domain/
    │   │   ├── entities/call-request.entity.ts
    │   │   ├── policies/           # working-hours policy, lifecycle transition rules
    │   │   └── ports/               # repository port, event-publisher port
    │   ├── application/            # one use case per action: reserve, approve, reject, cancel, mark-called, add-note
    │   └── infrastructure/
    │       ├── http/                # user-facing + admin controllers
    │       ├── mongo/                # repository adapter + schema (embeds the outbox)
    │       └── outbox/               # OutboxDispatcherService — the change-stream relay
    └── availability/                # bounded context — read model derived from call-request
        ├── domain/policies/         # reuses working-hours policy
        └── infrastructure/mongo/    # read-only slot lookup
```

`scheduler-service` and `communication-service` stay flat — a `consumers/`
folder, a `state/` or `templates/` folder, and one `app.module.ts` each; no
`domain/`/`application/`/`infrastructure/` split, for the reasons described
above.

## Running with Docker

The full system — MongoDB, RabbitMQ, MailHog, all three NestJS services, and
the frontend — is fully containerized. As required by the assignment, the
compose files live in `scripts/`, and the stack comes up from there:

```bash
cd scripts
cp .env.example .env
docker compose up --build -d
docker compose ps
```

`scripts/.env`'s `COMPOSE_FILE` value merges `docker-compose.yml` (base
service definitions) with `docker-compose.dev.yml` (a local overlay that
publishes every container's port to `localhost` and supplies default
credentials), so `docker compose up` is sufficient.

Once the stack is healthy:

| Service | URL | Notes |
|---|---|---|
| Frontend | http://localhost:4200 | User view / Admin view |
| Call Requests Service API | http://localhost:3001 | REST API the frontend calls |
| Scheduler Service | — | no HTTP surface; internal only |
| Communication Service | — | no HTTP surface; internal only |
| RabbitMQ Management UI | http://localhost:15672 | user/pass: `reservation` / `reservation` |
| MailHog inbox | http://localhost:8025 | every email sent by the system lands here |
| MongoDB | `mongodb://localhost:27017/?replicaSet=rs0&directConnection=true` | single-member `rs0` replica set (required for change streams) |

To stop the stack while keeping data:

```bash
cd scripts
docker compose down
```

To also remove the MongoDB and RabbitMQ volumes:

```bash
cd scripts
docker compose down --volumes
```

## Local development

For faster iteration than rebuilding Docker images on every change, run only
the infrastructure containers and run the NestJS/React apps on the host via
Nx:

```bash
# 1) infra only — MongoDB (as a replica set), RabbitMQ (with the delayed
#    exchange plugin) and MailHog
cd scripts
cp .env.example .env
docker compose up -d mongodb mongodb-init rabbitmq mailhog

# 2) each app's own .env, pointing at the ports exposed above
cd ..
cp apps/call-requests-service/.env.example apps/call-requests-service/.env
cp apps/scheduler-service/.env.example apps/scheduler-service/.env
cp apps/communication-service/.env.example apps/communication-service/.env
cp apps/web-service/.env.example apps/web-service/.env

# 3) run every app in watch mode via Nx
npm install
npm run dev   # nx run-many -t serve --parallel=4
```

Each service can also be served individually, e.g.
`npx nx serve call-requests-service`. Other commands:

```bash
npm test              # nx run-many -t test — unit tests for every project
npm run lint          # nx run-many -t lint
```

## Viewing the mock emails

Communication Service is the only service that sends email. Two ways to
inspect what was sent:

- **MailHog UI:** http://localhost:8025 — every email as a rendered message
  (from/to/subject/body), for the whole run.
- **Docker logs:** `docker compose logs -f communication-service` (from
  `scripts/`) — every send is logged with the recipient partially masked,
  e.g. `j***n@example.com`.
