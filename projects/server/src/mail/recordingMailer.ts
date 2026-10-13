import { Mailer, PasswordResetMail } from './mailer';

// A test double that keeps every mail, so a test can follow the emailed link.
export class RecordingMailer implements Mailer {
  readonly sent: PasswordResetMail[] = [];

  async sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    this.sent.push(mail);
  }
}
