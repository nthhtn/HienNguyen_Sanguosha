import { RateLimit, RateLimiter } from './rateLimiter';

const MINUTE = 60_000;

export interface RateLimitRules {
  signInPerIp: RateLimit;
  signInPerEmail: RateLimit;
  // Sign-up and guest creation share one budget.
  signUpPerIp: RateLimit;
  forgotPerIp: RateLimit;
  forgotPerEmail: RateLimit;
  // Guards the scrypt hash a reset costs.
  resetPerIp: RateLimit;
}

export const RATE_LIMITS: RateLimitRules = {
  signInPerIp: { limit: 30, windowMs: 15 * MINUTE },
  signInPerEmail: { limit: 10, windowMs: 15 * MINUTE },
  signUpPerIp: { limit: 10, windowMs: 60 * MINUTE },
  forgotPerIp: { limit: 10, windowMs: 60 * MINUTE },
  forgotPerEmail: { limit: 3, windowMs: 60 * MINUTE },
  resetPerIp: { limit: 10, windowMs: 60 * MINUTE },
};

export class AuthRateLimits {
  readonly signInIp: RateLimiter;
  readonly signInEmail: RateLimiter;
  readonly signUpIp: RateLimiter;
  readonly forgotIp: RateLimiter;
  readonly forgotEmail: RateLimiter;
  readonly resetIp: RateLimiter;

  constructor(rules: RateLimitRules = RATE_LIMITS) {
    this.signInIp = new RateLimiter(rules.signInPerIp);
    this.signInEmail = new RateLimiter(rules.signInPerEmail);
    this.signUpIp = new RateLimiter(rules.signUpPerIp);
    this.forgotIp = new RateLimiter(rules.forgotPerIp);
    this.forgotEmail = new RateLimiter(rules.forgotPerEmail);
    this.resetIp = new RateLimiter(rules.resetPerIp);
  }

  prune(now: number): void {
    for (const limiter of [this.signInIp, this.signInEmail, this.signUpIp, this.forgotIp, this.forgotEmail, this.resetIp]) limiter.prune(now);
  }
}
