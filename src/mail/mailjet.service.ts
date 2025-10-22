import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Mailjet from 'node-mailjet';

export interface MailjetEmailData {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  fromName?: string;
  fromEmail?: string;
}

@Injectable()
export class MailjetService {
  private readonly logger = new Logger(MailjetService.name);
  private readonly mailjet: Mailjet | null;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('MAILJET_API_KEY');
    const apiSecret = this.config.get<string>('MAILJET_API_SECRET');
    
    this.fromEmail = this.config.get<string>('MAILJET_FROM_EMAIL') || 'no-reply@mariusz-sokolowski.ch';
    this.fromName = this.config.get<string>('MAILJET_FROM_NAME') || 'Mariusz Sokołowski';

    if (!apiKey || !apiSecret) {
      this.logger.warn('Mailjet credentials not configured. Email sending will be disabled.');
      this.mailjet = null;
      return;
    }

    this.mailjet = new Mailjet({
      apiKey,
      apiSecret,
    });

    this.logger.log('Mailjet service initialized');
  }

  async sendEmail(data: MailjetEmailData): Promise<boolean> {
    if (!this.mailjet) {
      this.logger.warn('Mailjet not configured, skipping email send');
      return false;
    }

    try {
      const request = this.mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: {
              Email: this.fromEmail,
              Name: this.fromName,
            },
            To: [
              {
                Email: data.to,
                Name: data.to.split('@')[0], // Use email prefix as name
              },
            ],
            Subject: data.subject,
            TextPart: data.textContent || data.htmlContent.replace(/<[^>]*>/g, ''), // Strip HTML for text version
            HTMLPart: data.htmlContent,
          },
        ],
      });

      const result = await request;
      
      if (result.body && typeof result.body === 'object' && 'Messages' in result.body) {
        const messages = (result.body as any).Messages;
        if (messages && messages[0] && messages[0].Status === 'success') {
          this.logger.log(`Email sent successfully to ${data.to}`);
          return true;
        }
      }
      
      this.logger.error(`Failed to send email to ${data.to}:`, result.body);
      return false;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Mailjet error sending email to ${data.to}: ${reason}`);
      return false;
    }
  }

  async sendLoginTokenEmail(email: string, token: string): Promise<boolean> {
    const loginUrl = `${this.config.get<string>('LOGIN_REFRESH_URL')}?token=${token}`;
    
    const htmlContent = `
      <h2>Kod logowania</h2>
      <p>Oto Twój kod logowania:</p>
      <p style="font-size: 24px; font-weight: bold; color: #007bff;">${token}</p>
      <p>Lub kliknij poniższy link:</p>
      <a href="${loginUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Zaloguj się</a>
      <p>Kod jest ważny przez ${this.config.get<number>('LOGIN_CODE_TTL_HOURS') || 24} godzin.</p>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Kod logowania - Mariusz Sokołowski',
      htmlContent,
    });
  }

  async sendContactFormNotification(submission: any): Promise<boolean> {
    const htmlContent = `
      <h2>Nowa wiadomość z formularza kontaktowego</h2>
      <p><strong>Imię:</strong> ${submission.name}</p>
      <p><strong>Email:</strong> ${submission.email}</p>
      <p><strong>Temat:</strong> ${submission.subject}</p>
      <p><strong>Kategoria:</strong> ${submission.category}</p>
      <p><strong>Priorytet:</strong> ${submission.priority}</p>
      <p><strong>Preferowany kontakt:</strong> ${submission.preferredContact}</p>
      <p><strong>Wiadomość:</strong></p>
      <p style="white-space: pre-wrap;">${submission.message}</p>
      <p><strong>Data:</strong> ${submission.submittedAt}</p>
    `;

    return this.sendEmail({
      to: this.config.get<string>('CONTACT_EMAIL') || 'kontakt@mariusz-sokolowski.ch',
      subject: `Nowa wiadomość: ${submission.subject}`,
      htmlContent,
    });
  }

  async sendContactFormAcknowledgement(submission: any): Promise<boolean> {
    const htmlContent = `
      <h2>Dziękujemy za wiadomość!</h2>
      <p>Drogi/a ${submission.name},</p>
      <p>Dziękujemy za kontakt. Otrzymaliśmy Twoją wiadomość i odpowiemy na nią tak szybko, jak to możliwe.</p>
      <p><strong>Podsumowanie wiadomości:</strong></p>
      <p><strong>Temat:</strong> ${submission.subject}</p>
      <p><strong>Wiadomość:</strong></p>
      <p style="white-space: pre-wrap;">${submission.message}</p>
      <p>Z poważaniem,<br>Mariusz Sokołowski</p>
    `;

    return this.sendEmail({
      to: submission.email,
      subject: 'Potwierdzenie otrzymania wiadomości',
      htmlContent,
    });
  }
}
