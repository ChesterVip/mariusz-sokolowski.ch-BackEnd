import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

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
  private readonly transporter?: nodemailer.Transporter;
  private readonly adminRecipient: string;
  private readonly contactFormRecipient: string;
  private readonly contactAcknowledgementEnabled: boolean;

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
  }

  async sendLoginTokenEmail(options: SendLoginTokenOptions): Promise<void> {
    const from = this.config.get<string>('MAIL_FROM', 'no-reply@mariusz-sokolowski.ch');
    const refreshUrl =
      options.refreshUrl ?? this.config.get<string>('LOGIN_REFRESH_URL', '').trim();
    const language = this.normalizeLanguage(options.language);
    const isReminder = options.isReminder ?? false;
    const issuedAt = options.issuedAt ?? new Date();
    const { subject, html } = this.composeLoginTokenEmail({
      language,
      isReminder,
      code: options.code,
      issuedAt,
      expiresAt: options.expiresAt,
      refreshUrl,
    });

    if (this.transporter) {
      await this.transporter.sendMail({
        from,
        to: options.to,
        subject,
        html,
      });
    } else {
      const logParts = [
        `Login code for ${options.to}`,
        `code=${options.code}`,
        `expires=${options.expiresAt.toISOString()}`,
        `language=${language}`,
        `reminder=${isReminder}`,
      ];
      if (refreshUrl) {
        logParts.push(`refreshUrl=${refreshUrl}`);
      }
      this.logger.log(logParts.join(' | '));
    }
  }

  async sendAccessRequestNotification(
    options: SendAccessRequestNotificationOptions,
  ): Promise<void> {
    const from = this.config.get<string>('MAIL_FROM', 'no-reply@mariusz-sokolowski.ch');
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

    if (this.transporter) {
      await this.transporter.sendMail({
        from,
        to: this.adminRecipient,
        subject,
        html,
      });
    } else {
      this.logger.log(
        `Access request notification -> ${this.adminRecipient}: ${JSON.stringify(options)}`,
      );
    }
  }

  async sendContactFormNotification(submission: ContactFormSubmission): Promise<void> {
    const from = this.config.get<string>('MAIL_FROM', 'no-reply@mariusz-sokolowski.ch');
    const preferredContactLabel = this.getPreferredContactLabel(submission.preferredContact);
    const html = `
      <p>Nowa wiadomość z formularza kontaktowego:</p>
      <ul>
        <li><strong>Imię i nazwisko:</strong> ${this.escapeHtml(submission.name)}</li>
        <li><strong>Email:</strong> ${this.escapeHtml(submission.email)}</li>
        <li><strong>Telefon:</strong> ${this.escapeHtml(submission.phone ?? 'Nie podano')}</li>
        <li><strong>Firma:</strong> ${this.escapeHtml(submission.company ?? 'Nie podano')}</li>
        <li><strong>Kategoria:</strong> ${this.escapeHtml(submission.category)}</li>
        <li><strong>Priorytet:</strong> ${this.escapeHtml(submission.priority)}</li>
        <li><strong>Preferowany kontakt:</strong> ${this.escapeHtml(preferredContactLabel)}</li>
        <li><strong>Budżet:</strong> ${this.escapeHtml(submission.budget ?? 'Nie określono')}</li>
        <li><strong>Termin:</strong> ${this.escapeHtml(submission.timeline ?? 'Nie określono')}</li>
        <li><strong>Zgoda RODO:</strong> ${submission.gdprConsent ? 'TAK' : 'NIE'}</li>
        <li><strong>Zgoda marketingowa:</strong> ${submission.marketingConsent ? 'TAK' : 'NIE'}</li>
        <li><strong>Wysłano:</strong> ${submission.submittedAt.toLocaleString()}</li>
      </ul>
      <p><strong>Treść wiadomości:</strong></p>
      <p>${this.escapeHtml(submission.message).replace(/\n/g, '<br/>')}</p>
    `;

    if (this.transporter) {
      await this.transporter.sendMail({
        from,
        to: this.contactFormRecipient,
        subject: `Nowa wiadomość z formularza: ${submission.subject}`,
        replyTo: submission.email,
        html,
      });
    } else {
      this.logger.log(
        `Contact form notification -> ${this.contactFormRecipient}: ${JSON.stringify(submission)}`,
      );
    }
  }

  async sendContactFormAcknowledgement(submission: ContactFormSubmission): Promise<void> {
    if (!this.contactAcknowledgementEnabled) {
      return;
    }

    const from = this.config.get<string>('MAIL_FROM', 'no-reply@mariusz-sokolowski.ch');
    const html = `
      <p>Cześć ${this.escapeHtml(submission.name)},</p>
      <p>Dziękujemy za wiadomość przesłaną przez formularz na stronie mariusz-sokolowski.ch.</p>
      <p>Odpowiemy na nią tak szybko, jak to będzie możliwe.</p>
      <p>Pozdrawiamy,<br/>Zespół mariusz-sokolowski.ch</p>
    `;

    if (this.transporter) {
      await this.transporter.sendMail({
        from,
        to: submission.email,
        subject: 'Dziękujemy za wiadomość',
        html,
      });
    } else {
      this.logger.log(
        `Contact form acknowledgement (console) -> ${submission.email}: ${submission.subject}`,
      );
    }
  }

  private composeLoginTokenEmail(params: {
    language: string;
    isReminder: boolean;
    code: string;
    issuedAt: Date;
    expiresAt: Date;
    refreshUrl?: string;
  }): { subject: string; html: string } {
    const { language, isReminder, code, issuedAt, expiresAt, refreshUrl } = params;
    const formattedIssuedAt = this.formatDateForLocale(
      issuedAt,
      language === 'de' ? 'de-CH' : 'pl-PL',
    );
    const formattedExpiresAt = this.formatDateForLocale(
      expiresAt,
      language === 'de' ? 'de-CH' : 'pl-PL',
    );

    if (language === 'de') {
      const subject = isReminder ? 'Erinnerung: Dein Login-Code' : 'Dein Login-Code';
      const html = `
        <p>Hallo,</p>
        <p>${isReminder ? 'wir senden dir deinen aktuellen Login-Code erneut.' : 'hier ist dein neuer Login-Code.'}</p>
        <p><strong>Code:</strong> ${this.escapeHtml(code)}</p>
        <p><strong>Erstellt am:</strong> ${this.escapeHtml(formattedIssuedAt)}</p>
        <p><strong>Gültig bis:</strong> ${this.escapeHtml(formattedExpiresAt)}</p>
        ${
          refreshUrl
            ? `<p>Falls der Code abläuft, kannst du jederzeit einen neuen anfordern: <a href="${refreshUrl}">${refreshUrl}</a></p>`
            : ''
        }
        <p>Viele Grüße,<br/>Team mariusz-sokolowski.ch</p>
      `;
      return { subject, html };
    }

    const subject = isReminder
      ? 'Przypomnienie: Twój kod logowania'
      : 'Twój kod logowania';
    const html = `
      <p>Cześć,</p>
      <p>${
        isReminder
          ? 'Przesyłamy Ci przypomnienie Twojego aktywnego kodu logowania.'
          : 'Twój kod logowania został właśnie wygenerowany.'
      }</p>
      <p><strong>Kod:</strong> ${this.escapeHtml(code)}</p>
      <p><strong>Kod wygenerowano:</strong> ${this.escapeHtml(formattedIssuedAt)}</p>
      <p><strong>Kod ważny do:</strong> ${this.escapeHtml(formattedExpiresAt)}</p>
      ${
        refreshUrl
          ? `<p>Jeśli kod wygaśnie, możesz wygenerować nowy pod tym adresem: <a href="${refreshUrl}">${refreshUrl}</a></p>`
          : ''
      }
      <p>Pozdrawiamy,<br/>Zespół mariusz-sokolowski.ch</p>
    `;
    return { subject, html };
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

  private getPreferredContactLabel(method: string): string {
    switch (method) {
      case 'email':
        return 'E-mail';
      case 'phone':
        return 'Telefon';
      case 'both':
        return 'E-mail i telefon';
      default:
        return method;
    }
  }
}
