export interface PasswordResetMail {
  to: string;
  displayName: string;
  link: string;
}

// How the server sends email. Dev uses ConsoleMailer; production gets a
// provider-backed implementation at deploy time.
export interface Mailer {
  sendPasswordReset(mail: PasswordResetMail): Promise<void>;
}

// Prints the link instead of sending it: open it from the server log.
export class ConsoleMailer implements Mailer {
  constructor(private readonly log: (line: string) => void = console.log) {}

  async sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    this.log(`[mail] Password reset for ${mail.to}: ${mail.link}`);
  }
}
