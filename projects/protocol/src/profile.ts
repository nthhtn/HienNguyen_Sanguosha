// What GET /api/me/profile answers: a registered player's record over finished games.
export type ProfileMode = 'all' | 'solo' | 'online';

// A seat's Force: its printed Kingdom, or 'ambitionist' when it played alone.
export type Force = 'Wei' | 'Shu' | 'Wu' | 'Qun' | 'ambitionist';

// `winRate` is wins over wins plus losses; null when there is neither.
export interface WinLoss {
  games: number;
  wins: number;
  losses: number;
  winRate: number | null;
}

export interface ForceRecord extends WinLoss {
  force: Force;
}

export interface GeneralRecord extends WinLoss {
  generalId: string;
}

export interface FormEntry {
  gameId: string;
  finishedAt: number;
  result: 'win' | 'loss' | 'none';
}

export interface ProfileStats {
  displayName: string;
  // Epoch milliseconds.
  memberSince: number;
  mode: ProfileMode;
  // `noOutcome` counts games with neither a win nor a loss for you.
  totals: WinLoss & { noOutcome: number };
  byForce: ForceRecord[];
  topGenerals: GeneralRecord[];
  // Newest first, at most 10.
  form: FormEntry[];
  streak: { current: number; best: number };
}

export interface UpdateProfileBody {
  displayName: string;
}

export interface ChangePasswordBody {
  // Left out by an account that has no password yet (it signed in with Google).
  currentPassword?: string;
  newPassword: string;
}
