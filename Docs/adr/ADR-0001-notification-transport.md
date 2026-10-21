# ADR-0001: Durable notification transport is Supabase Queues (pgmq)

Status: Proposed (Phase A, 20 Oct 2026; revised 21 Oct 2026 for design reviews 1 and 2). Spec: `Docs/Toade3_Notification_Architecture.md` §9 step 2, §13, §18 [R1]. Design: `.agents/tasks/notifications/design.md` (canonical; §6, §8).

## Context

The spec requires: owner transaction + outbox → durable queue → idempotent S6 consumer. It says to "select one deployment transport and record the decision before implementation", keep an existing SNS/SQS adapter if one is deployed, and treat Supabase Queues as the documented alternative for a Supabase-first pilot. Private Realtime is explicitly not the durable queue.

Repository facts: there is no SNS/SQS adapter and no AWS footprint. The only backend is Supabase project `mcnezedqjyqgbimxrdcz` (migrations 0001-0003). No owner domains (S5/S7/S1/S8/S2) exist yet.

## Options

1. **Supabase Queues (pgmq)**, Postgres-native. Producers call `pgmq.send` inside their own transaction, so the outbox write and the enqueue are atomic with no relay process. Consumers are Edge Functions on pg_cron.
2. **AWS SNS/SQS.** Needs a relay (outbox poller), IAM credentials in Edge secrets and a second platform to monitor. Nothing exists to keep.
3. **Outbox table polled directly (no queue).** Simplest, but it reinvents visibility timeouts, read counts and archiving, which pgmq already provides.
4. **Realtime / pg_net webhooks.** Not durable; rejected by the spec.

## Decision

Option 1: Supabase Queues (pgmq).

- Queue `messaging_events`: Basic, logged. Unlogged is rejected because it "may result in loss of Queue Messages".
- Producer path: each owner schema has `outbox` table → AFTER INSERT trigger → `messaging.enqueue_owner_event(envelope)` (SECURITY DEFINER, validates the envelope, `pgmq.send('messaging_events', envelope)`). This happens in the owner's transaction: a rolled-back owner command enqueues nothing. Outbox rows remain the owner's audit record.
- Consumer: Edge Function `messaging-worker` task `consume`. Read path: `messaging_worker.read_events(vt => 60, qty => 25)` wrapping `pgmq.read`. Commit path: `messaging_worker.commit_event(p_msg_id, p_envelope, p_plan)`, which applies the plan's typed projection writes, writes all S6 effects AND calls `pgmq.delete(msg_id)` in one transaction. A crash before commit means the message reappears after the visibility timeout and is reprocessed through `consumer_inbox (producer, event_id)` uniqueness.
- Never `pgmq.pop`: the docs say pop gives at-most-once semantics if processing isn't guaranteed.
- Poison handling: if `read_ct > 5`, or the envelope is invalid, `messaging_worker.dead_letter_event` copies the raw payload to `messaging.dead_letters` (keyed by `msg_id`, so even a non-UUID `event_id` can be stored) and calls `pgmq.archive` in one transaction. Health shows it. Replay (`replay_dead_letter`) re-sends through `pgmq.send` and the same idempotency gates; `dead_lettered`/`invalid` consumer results are non-terminal so a replay is processed once.
- Foreground hint: `enqueue_owner_event` also calls `realtime.send` (private topic, opaque payload, no copy) for order and delivery events inside the owner transaction, wrapped so a failure only warns. This is what makes the spec §13 foreground target reachable; it is best effort and not part of the durable path.
- No client access: we do NOT enable "Expose Queues via PostgREST" (`pgmq_public`). pgmq functions are reachable only through `messaging_worker` RPCs granted to `service_role`. The Supabase Queues quickstart notes that RLS is not enabled by default on pgmq tables, so 0004 also runs `alter table pgmq.q_messaging_events enable row level security`, the same for `pgmq.a_messaging_events`, and `revoke all` on both from `public, anon, authenticated`. pgTAP asserts no client privilege on either table and that RLS is on.
- Extension forms follow the Supabase docs: `create extension if not exists pgmq`, `pg_net with schema extensions` (pg_net guide), `pg_cron with schema pg_catalog` (Cron install guide), checked 21 Oct 2026.

## Availability check (Supabase docs, read 20-21 Oct 2026)

- `supabase.com/docs/guides/queues`: "Postgres-native durable Message Queue system with guaranteed delivery built on the pgmq database extension". "Exactly once… within a customizable visibility window". Messages persist until explicitly removed; archive is available.
- `guides/queues/quickstart`: enable via Dashboard > Integrations > Queues. "pgmq extension is available in Postgres version 15.6.1.143 or later". Each queue creates `pgmq.q_<name>` and `pgmq.a_<name>`. Queues are not exposed over the Data API by default; "RLS is not enabled by default on any tables" in the `pgmq` schema.
- `guides/queues/pgmq`: `pgmq.create`, `send(queue, msg jsonb, delay)`, `read(queue, vt, qty)` returning `msg_id, read_ct, enqueued_at, vt, message`, `delete`, `archive`, `set_vt`, `metrics(queue)` (queue_length, oldest_msg_age_sec).
- `guides/queues/consuming-messages-with-edge-functions`: Edge Function reads N messages and deletes each after processing; schedule with Supabase Cron.
- Release gate R-9 (design §21): the project's Postgres version must be ≥ 15.6.1.143. It wasn't checkable here because no SQL may be run. SETUP step: Dashboard > Settings > Infrastructure shows the version. If it is older, upgrade before running 0004. Also confirm the archive table's `archived_at` column (used by cleanup) against the installed pgmq version.

## Consequences

- Positive: one platform; atomic enqueue; built-in visibility timeout, read count, archive and metrics; no relay.
- Negative: polling latency (consume cron every 10 s, so source-to-inbox and source-to-push p95 is about 10-15 s). The S6 hint from `commit_event` has the same latency. The foreground path does not wait for it: the owner-transaction hint from `enqueue_owner_event` reaches subscribed Customer and Rider clients on owner commit, and they fetch the authorised snapshot. The spec §13 p95 < 500 ms target is therefore achievable by design but stays a release measurement (R-9, AC-14). Vendor foreground hints still come from `commit_event` (member resolution lives in S6), which is a known gap for the Vendor app; its task board reads S5 directly. Canonical order screens never depend on S6.
- pgmq is FIFO without priorities. P0 urgency comes from dispatch ordering (`priority, created_at`), not queue order.
- Delivery is at-least-once end to end. Correctness relies on the three dedupe boundaries (§13), not on the queue.
- A future move to SNS/SQS replaces `messaging.enqueue_owner_event` and the `consume` read/delete calls only. The commit RPC and the policy core don't change.
