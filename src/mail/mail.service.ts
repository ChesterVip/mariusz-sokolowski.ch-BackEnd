import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

interface SendLoginTokenOptions {
  to: string;
  code: string;
  expiresAt: Date;
  refreshUrl?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter?: Transporter;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn(
        'SMTP credentials are not fully configured. Falling back to console output for emails.',
      );
    }
  }

  async sendLoginTokenEmail(options: SendLoginTokenOptions): Promise<void> {
    const from = this.config.get<string>('MAIL_FROM', 'no-reply@mariusz-sokolowski.ch');
    const refreshUrl =
      options.refreshUrl ?? this.config.get<string>('LOGIN_REFRESH_URL', '').trim();

    const html = `
      <p>Cześć,</p>
      <p>Twój kod logowania to: <strong>${options.code}</strong></p>
      <p>Kod jest ważny do ${options.expiresAt.toLocaleString()}.</p>
      ${
        refreshUrl
          ? `<p>Jeśli kod wygaśnie, możesz wygenerować nowy pod tym adresem: <a href="${refreshUrl}">${refreshUrl}</a></p>`
          : ''
      }
      <p>Pozdrawiamy,<br/>Zespół mariusz-sokolowski.ch</p>
    `;

    if (this.transporter) {
      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: 'Twój kod logowania',
        html,
      });
    } else {
      this.logger.log(
        `Login code for ${options.to}: ${options.code} (expires at ${options.expiresAt.toISOString()})`,
      );
      if (refreshUrl) {
        this.logger.log(`Refresh link: ${refreshUrl}`);
      }
    }
  }
}
