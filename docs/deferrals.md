# Deferrals

Work that was decided, on purpose, to leave for later. Each entry says what is
missing, why it waits and what would bring it back. When an item is done, delete
its entry and say where it went in the commit.

## Deployment

| Deferred | Why it waits | Revisit when |
|---|---|---|
| **A real Mailer.** Password reset emails only print to the server log (`[mail] Password reset for …`), so on a hosted server nobody can reset a password. | The first live deployment is for a few friends. Sign-up, sign-in and guests work without email. A forgotten password is handled by hand for now. | Players beyond the first friends sign up, or someone is locked out. Needs a provider-backed `Mailer` in `projects/server/src/mail/`. |
| **Keeping the free host awake.** A free Render web service sleeps after about 15 minutes without traffic, and the first visit then waits for a cold start. | Decided on 2026-10-26 to accept the sleep for now. Games survive it: the server rebuilds each running game by replaying its action log. | The cold start gets in the way of playing. A pinger on `/healthz`, or an always-on host such as an Oracle Always Free VM, would fix it. |
| **A verified database certificate.** `DATABASE_SSL=require` encrypts the Supabase connection but does not check the certificate chain, because the pooler's chain is not in Node's trust store. | Friends-only game; the traffic is still encrypted. | The game goes public. Pass Supabase's CA certificate to `pg` and turn verification on. |
| **A dedicated database role.** The server connects as the default `postgres` user. | Decided on 2026-10-26 to keep setup simple. | Before a wider launch. Needs grants for the migrations and the app. |

## Backend

From [Backend and deployment](architecture/backend-and-deployment.md#not-done),
which holds the detail:

- Spectators, room codes and passwords, share links, matchmaking, ratings and
  friends lists.
- A replay viewer. The data and the debug endpoint exist.
- More than one server process. Live games live in the memory of one process.
- Merging a guest's games into a new account, and a recovery code for a guest's
  seat.
- Email verification.
