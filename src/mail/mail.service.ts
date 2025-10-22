import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailjetService } from './mailjet.service';

interface SendLoginTokenOptions {
  to: string;
  code: string;
  expiresAt: Date;
  refreshUrl?: string;
  language?: string;
  isReminder?: boolean;
  issuedAt?: Date;
  metadata?: TokenRequestMetadata;
}

interface SendAccessRequestNotificationOptions {
  requesterEmail: string;
  userExists: boolean;
  action: 'new-token' | 'token-reminder';
  tokenExpiresAt?: Date;
  tokenIssuedAt?: Date;
  metadata?: TokenRequestMetadata;
}

interface TokenRequestMetadata {
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  language?: string;
  country?: string;
  deviceType?: string;
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  osVersion?: string;
  userAgent?: string;
  ipAddress?: string;
}

interface ContactFormSubmission {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  preferredContact: string;
  budget?: string;
  timeline?: string;
  gdprConsent: boolean;
  marketingConsent?: boolean;
  submittedAt: Date;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly adminRecipient: string;
  private readonly contactFormRecipient: string;
  private readonly contactAcknowledgementEnabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly mailjetService: MailjetService,
  ) {
    const adminRecipientConfig = this.config
      .get<string>('SECURE_ACCESS_NOTIFICATION_EMAIL', 'info@mariusz-sokolowski.ch')
      ?.trim();
    this.adminRecipient =
      adminRecipientConfig && adminRecipientConfig.length > 0
        ? adminRecipientConfig
        : 'info@mariusz-sokolowski.ch';

    const contactRecipientConfig = this.config
      .get<string>('CONTACT_FORM_RECIPIENT', this.adminRecipient)
      ?.trim();
    this.contactFormRecipient =
      contactRecipientConfig && contactRecipientConfig.length > 0
        ? contactRecipientConfig
        : this.adminRecipient;

    this.contactAcknowledgementEnabled =
      this.config.get<string>('CONTACT_FORM_SEND_ACK', 'true') !== 'false';

    this.logger.log('MailService initialized - using Mailjet for all email sending');
  }

  async sendLoginTokenEmail(options: SendLoginTokenOptions): Promise<void> {
    try {
      const language = this.normalizeLanguage(options.language);
      const success = await this.mailjetService.sendLoginTokenEmail(options.to, options.code, language);
      if (!success) {
        throw new Error('Failed to send email via Mailjet');
      }
      this.logger.log(`Login token email sent successfully to ${options.to}`);
    } catch (error) {
      this.logger.error(`Failed to send login token email via Mailjet to ${options.to}: ${this.describeMailerError(error)}`);
      throw error;
    }
  }

  async sendAccessRequestNotification(
    options: SendAccessRequestNotificationOptions,
  ): Promise<void> {
    try {
      const metadata = options.metadata ?? {};
      const subject =
        options.action === 'token-reminder'
          ? 'Przypomnienie tokenu logowania'
          : 'Nowy token logowania';
      
      const actionDescription =
        options.action === 'token-reminder'
          ? 'Użytkownik poprosił o ponowne przesłanie aktywnego tokenu logowania.'
          : 'Użytkownik otrzymał nowo wygenerowany token logowania.';

      const html = `
        <p>Witaj,</p>
        <p>${actionDescription}</p>
        <ul>
          <li><strong>Email:</strong> ${this.escapeHtml(options.requesterEmail)}</li>
          <li><strong>Status konta:</strong> ${
            options.userExists ? 'użytkownik istnieje' : 'brak konta'
          }</li>
          <li><strong>Imię:</strong> ${this.escapeHtml(metadata.firstName ?? 'Nie podano')}</li>
          <li><strong>Nazwisko:</strong> ${this.escapeHtml(metadata.lastName ?? 'Nie podano')}</li>
          <li><strong>Telefon:</strong> ${this.escapeHtml(metadata.phone ?? 'Nie podano')}</li>
          <li><strong>Firma:</strong> ${this.escapeHtml(metadata.company ?? 'Nie podano')}</li>
          <li><strong>Język interfejsu:</strong> ${this.escapeHtml(metadata.language ?? 'Nie podano')}</li>
          <li><strong>Kraj:</strong> ${this.escapeHtml(metadata.country ?? 'Nie ustalono')}</li>
          <li><strong>Typ urządzenia:</strong> ${this.escapeHtml(metadata.deviceType ?? 'Nie ustalono')}</li>
          <li><strong>Przeglądarka:</strong> ${this.escapeHtml(
            this.combineNameAndVersion(metadata.browserName, metadata.browserVersion) ?? 'Nie ustalono',
          )}</li>
          <li><strong>System:</strong> ${this.escapeHtml(
            this.combineNameAndVersion(metadata.osName, metadata.osVersion) ?? 'Nie ustalono',
          )}</li>
          <li><strong>Adres IP:</strong> ${this.escapeHtml(metadata.ipAddress ?? 'Nie ustalono')}</li>
        </ul>
        <p>Dodatkowe informacje o tokenie:</p>
        <ul>
          <li><strong>Wydano:</strong> ${
            options.tokenIssuedAt
              ? this.formatDateForLocale(options.tokenIssuedAt, 'pl-PL')
              : 'Nie dotyczy'
          }</li>
          <li><strong>Ważny do:</strong> ${
            options.tokenExpiresAt
              ? this.formatDateForLocale(options.tokenExpiresAt, 'pl-PL')
              : 'Nie dotyczy'
          }</li>
        </ul>
        ${
          metadata.userAgent
            ? `<p><strong>Pełny nagłówek User-Agent:</strong><br/>${this.escapeHtml(metadata.userAgent)}</p>`
            : ''
        }
        <p>--<br/>Automatyczne powiadomienie z mariusz-sokolowski.ch</p>
      `;

      const success = await this.mailjetService.sendEmail({
        to: this.adminRecipient,
        subject,
        htmlContent: html,
        fromName: 'Mariusz Sokołowski',
        fromEmail: 'no-reply@mariusz-sokolowski.ch'
      });

      if (!success) {
        throw new Error('Failed to send access notification via Mailjet');
      }
      
      this.logger.log(`Access request notification sent successfully to ${this.adminRecipient}`);
    } catch (error) {
      this.logger.error(
        `Failed to send access notification to ${this.adminRecipient}: ${this.describeMailerError(error)}`,
      );
      throw error;
    }
  }

  async sendContactFormNotification(submission: ContactFormSubmission): Promise<void> {
    try {
      const success = await this.mailjetService.sendContactFormNotification(submission);
      if (!success) {
        throw new Error('Failed to send contact form notification via Mailjet');
      }
      this.logger.log(`Contact form notification sent successfully to ${this.contactFormRecipient}`);
    } catch (error) {
      this.logger.error(`Failed to send contact form notification via Mailjet: ${this.describeMailerError(error)}`);
      throw error;
    }
  }

  async sendContactFormAcknowledgement(submission: ContactFormSubmission): Promise<void> {
    if (!this.contactAcknowledgementEnabled) {
      return;
    }

    try {
      const success = await this.mailjetService.sendContactFormAcknowledgement(submission);
      if (!success) {
        throw new Error('Failed to send contact form acknowledgement via Mailjet');
      }
      this.logger.log(`Contact form acknowledgement sent successfully to ${submission.email}`);
    } catch (error) {
      this.logger.error(`Failed to send contact form acknowledgement via Mailjet: ${this.describeMailerError(error)}`);
      throw error;
    }
  }

  private normalizeLanguage(language?: string): string {
    if (!language) {
      return 'pl';
    }
    const normalized = language.toLowerCase();
    if (normalized.startsWith('de')) {
      return 'de';
    }
    if (normalized.startsWith('pl')) {
      return 'pl';
    }
    return 'pl';
  }

  private formatDateForLocale(date: Date, locale: string): string {
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(date);
    } catch {
      return date.toLocaleString();
    }
  }

  private combineNameAndVersion(name?: string, version?: string): string | undefined {
    if (!name && !version) {
      return undefined;
    }
    if (name && version) {
      return `${name} ${version}`;
    }
    return name ?? version ?? undefined;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case '\'':
          return '&#39;';
        default:
          return char;
      }
    });
  }

  private describeMailerError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }
    return 'Unknown error';
  }
}