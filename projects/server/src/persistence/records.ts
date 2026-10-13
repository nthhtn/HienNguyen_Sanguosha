import type { UserKind } from 'protocol';

// Domain records: what the server works with. Database rows map to these in
// persistence/postgres/mappers.ts, and these map to wire shapes in views/.
export interface UserRecord {
  id: string;
  kind: UserKind;
  email: string | null; // registered only
  passwordHash: string | null; // registered only
  displayName: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface ResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}
