import type { Me } from 'protocol';
import { UserRecord } from '../persistence/records';

// The signed-in user as the client sees it: never the hash or timestamps.
export function toMe(user: UserRecord): Me {
  return {
    id: user.id,
    kind: user.kind,
    displayName: user.displayName,
    ...(user.kind === 'registered' && user.email ? { email: user.email } : {}),
    // False for a Google account that has not set a password yet.
    ...(user.kind === 'registered' ? { hasPassword: user.passwordHash !== null } : {}),
  };
}
