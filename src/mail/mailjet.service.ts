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
  replyToEmail?: string;
  replyToName?: string;
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

    const defaultEmail = 'info@mariusz-sokolowski.ch';
    const defaultName = 'Mariusz Sokołowski';
    const configuredFrom = this.parseAddress(this.config.get<string>('MAILJET_FROM_EMAIL'));
    const configuredName = this.config.get<string>('MAILJET_FROM_NAME')?.trim();

    if (configuredFrom?.raw && configuredFrom.warn) {
      this.logger.warn(
        `MAILJET_FROM_EMAIL value "${configuredFrom.raw}" is not a valid email address. Falling back to ${defaultEmail}.`,
      );
    } else if (configuredFrom?.raw && configuredFrom.nameExtracted) {
      this.logger.log(
        `Extracted sender name "${configuredFrom.nameExtracted}" and email "${configuredFrom.email}" from MAILJET_FROM_EMAIL value.`,
      );
    }

    this.fromEmail = configuredFrom?.email ?? defaultEmail;
    this.fromName = configuredName?.length
      ? configuredName
      : configuredFrom?.name ?? defaultName;

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
      const fromEmail = this.resolveEmail(data.fromEmail, this.fromEmail, 'From');
      const fromName = data.fromName?.trim().length ? data.fromName.trim() : this.fromName;
      const replyToEmail = this.resolveEmail(data.replyToEmail, fromEmail, 'Reply-To');
      const replyToName = data.replyToName?.trim().length ? data.replyToName.trim() : fromName;

      const request = this.mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: {
              Email: fromEmail, // nadawca zautoryzowany w Mailjet
              Name: fromName,
            },
            ReplyTo: {
              Email: replyToEmail,
              Name: replyToName,
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

  async sendLoginTokenEmail(email: string, token: string, language: string = 'pl'): Promise<boolean> {
    const loginUrl = `${this.config.get<string>('LOGIN_REFRESH_URL')}?token=${token}`;
    
    const { subject, htmlContent } = this.generateLoginTokenEmail(token, loginUrl, language);
    
    return this.sendEmail({
      to: email,
      subject,
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
    const language = this.detectLanguage(submission);
    const { subject, htmlContent } = this.generateContactAcknowledgementEmail(submission, language);

    return this.sendEmail({
      to: submission.email,
      subject,
      htmlContent,
    });
  }

  private resolveEmail(candidate: string | undefined, fallback: string, label: string): string {
    if (!candidate) {
      return fallback;
    }

    const parsed = this.parseAddress(candidate);
    if (!parsed?.email) {
      this.logger.warn(
        `${label} email "${candidate}" is invalid. Using fallback address ${fallback}.`,
      );
      return fallback;
    }

    return parsed.email;
  }

  private parseAddress(
    value: string | undefined | null,
  ): { email?: string; name?: string; raw: string; warn?: boolean; nameExtracted?: string } | null {
    if (!value) {
      return null;
    }

    const raw = value.trim();
    if (!raw) {
      return null;
    }

    const angleMatch = raw.match(/^([^<]+)?<([^>]+)>$/);
    if (angleMatch) {
      const nameCandidate = this.sanitizeName(angleMatch[1]);
      const emailCandidate = angleMatch[2].trim();
      if (!this.isValidEmail(emailCandidate)) {
        return { raw, warn: true };
      }
      return {
        raw,
        email: emailCandidate,
        name: nameCandidate ?? undefined,
        nameExtracted: nameCandidate ?? undefined,
      };
    }

    const simpleEmail = raw.replace(/^"(.*)"$/, '$1').trim();
    if (this.isValidEmail(simpleEmail)) {
      return { raw, email: simpleEmail };
    }

    const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
    const emailMatch = raw.match(emailPattern);
    if (emailMatch) {
      const emailCandidate = emailMatch[0].trim();
      if (!this.isValidEmail(emailCandidate)) {
        return { raw, warn: true };
      }

      const before = raw.slice(0, emailMatch.index ?? 0).trim();
      const afterIndex = (emailMatch.index ?? 0) + emailMatch[0].length;
      const after = raw.slice(afterIndex).trim();
      const nameCandidate = this.sanitizeName([before, after].filter(Boolean).join(' '));

      return {
        raw,
        email: emailCandidate,
        name: nameCandidate ?? undefined,
        nameExtracted: nameCandidate ?? undefined,
      };
    }

    return { raw, warn: true };
  }

  private sanitizeName(value: string | undefined | null): string | null {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const withoutQuotes = trimmed.replace(/^"(.*)"$/, '$1').trim();
    return withoutQuotes.length ? withoutQuotes : null;
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private detectLanguage(submission: any): string {
    // Try to detect language from various sources
    if (submission.language) {
      return submission.language.toLowerCase();
    }
    
    // Check if message contains German words
    const germanWords = ['der', 'die', 'das', 'und', 'ist', 'mit', 'für', 'von', 'auf', 'an'];
    const message = submission.message?.toLowerCase() || '';
    const germanCount = germanWords.filter(word => message.includes(word)).length;
    
    if (germanCount >= 3) {
      return 'de';
    }
    
    return 'pl'; // Default to Polish
  }

  private generateContactAcknowledgementEmail(submission: any, language: string): { subject: string; htmlContent: string } {
    const isGerman = language.toLowerCase().startsWith('de');
    
    if (isGerman) {
      return {
        subject: 'Bestätigung Ihrer Nachricht - Mariusz Sokołowski',
        htmlContent: this.generateStyledEmail(
          'Nachricht erhalten',
          `Hallo ${submission.name}!`,
          'Vielen Dank für Ihre Nachricht. Wir haben Ihre Anfrage erhalten und werden so schnell wie möglich antworten.',
          null,
          null,
          null,
          'Zusammenfassung Ihrer Nachricht:',
          'Mit freundlichen Grüßen,<br>Mariusz Sokołowski<br><br><small style="color: #a0a0a0;">Haben Sie Fragen? Schreiben Sie an: <a href="mailto:kontakt@fgfalke.eu" style="color: #fdcb6e; text-decoration: none;">kontakt@fgfalke.eu</a></small>',
          'de',
          {
            subject: submission.subject,
            message: submission.message,
            category: submission.category,
            priority: submission.priority
          }
        )
      };
    }
    
    return {
      subject: 'Potwierdzenie otrzymania wiadomości - Mariusz Sokołowski',
      htmlContent: this.generateStyledEmail(
        'Wiadomość otrzymana',
        `Cześć ${submission.name}!`,
        'Dziękujemy za wiadomość. Otrzymaliśmy Twoją wiadomość i odpowiemy na nią tak szybko, jak to możliwe.',
        null,
        null,
        null,
        'Podsumowanie Twojej wiadomości:',
        'Z poważaniem,<br>Mariusz Sokołowski<br><br><small style="color: #a0a0a0;">Masz pytania? Napisz na: <a href="mailto:kontakt@fgfalke.eu" style="color: #fdcb6e; text-decoration: none;">kontakt@fgfalke.eu</a></small>',
        'pl',
        {
          subject: submission.subject,
          message: submission.message,
          category: submission.category,
          priority: submission.priority
        }
      )
    };
  }

  private generateLoginTokenEmail(token: string, loginUrl: string, language: string): { subject: string; htmlContent: string } {
    const isGerman = language.toLowerCase().startsWith('de');
    
    if (isGerman) {
      return {
        subject: 'Ihr Login-Code - Mariusz Sokołowski',
        htmlContent: this.generateStyledEmail(
          'Ihr Login-Code',
          'Hallo!',
          'Hier ist Ihr persönlicher Login-Code:',
          token,
          loginUrl,
          'Anmelden',
        'Der Code ist 24 Stunden gültig.',
        'Mit freundlichen Grüßen,<br>Mariusz Sokołowski<br><br><small style="color: #a0a0a0;">Haben Sie Fragen? Schreiben Sie an: <a href="mailto:kontakt@fgfalke.eu" style="color: #fdcb6e; text-decoration: none;">kontakt@fgfalke.eu</a></small>',
          'de'
        )
      };
    }
    
    return {
      subject: 'Kod logowania - Mariusz Sokołowski',
      htmlContent: this.generateStyledEmail(
        'Kod logowania',
        'Cześć!',
        'Oto Twój osobisty kod logowania:',
        token,
        loginUrl,
        'Zaloguj się',
        'Kod jest ważny przez 24 godziny.',
        'Z poważaniem,<br>Mariusz Sokołowski<br><br><small style="color: #a0a0a0;">Masz pytania? Napisz na: <a href="mailto:kontakt@fgfalke.eu" style="color: #fdcb6e; text-decoration: none;">kontakt@fgfalke.eu</a></small>',
        'pl'
      )
    };
  }

  private generateStyledEmail(
    title: string,
    greeting: string,
    message: string,
    token: string | null,
    buttonUrl: string | null,
    buttonText: string | null,
    footer: string,
    signature: string,
    language: string,
    summary?: any
  ): string {
    const isRTL = language === 'ar' || language === 'he';
    const textAlign = isRTL ? 'right' : 'left';
    
    const tokenSection = token ? `
      <div class="token-container">
        <div class="token-glow"></div>
        <p class="token">${token}</p>
        <div class="token-border"></div>
      </div>
    ` : '';
    
    const buttonSection = buttonUrl && buttonText ? `
      <div class="button-container">
        <a href="${buttonUrl}" class="button">
          <span class="button-text">${buttonText}</span>
          <div class="button-glow"></div>
        </a>
      </div>
    ` : '';
    
    const summarySection = summary ? `
      <div class="summary-container">
        <div class="summary-header">
          <h3>${language.startsWith('de') ? 'Zusammenfassung:' : 'Podsumowanie:'}</h3>
          <div class="summary-icon">📋</div>
        </div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">${language.startsWith('de') ? 'Betreff:' : 'Temat:'}</div>
            <div class="summary-value">${summary.subject}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${language.startsWith('de') ? 'Kategorie:' : 'Kategoria:'}</div>
            <div class="summary-value">${summary.category}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">${language.startsWith('de') ? 'Priorität:' : 'Priorytet:'}</div>
            <div class="summary-value priority-${summary.priority}">${summary.priority}</div>
          </div>
          <div class="summary-item full-width">
            <div class="summary-label">${language.startsWith('de') ? 'Nachricht:' : 'Wiadomość:'}</div>
            <div class="message-content">${summary.message}</div>
          </div>
        </div>
      </div>
    ` : '';
    
    return `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #ffffff;
            background: linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%);
            margin: 0;
            padding: 20px;
            direction: ${isRTL ? 'rtl' : 'ltr'};
            min-height: 100vh;
          }
          
          /* Tech Grid Background */
          body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: radial-gradient(circle at 2px 2px, rgba(253, 203, 110, 0.1) 1px, transparent 0);
            background-size: 40px 40px;
            pointer-events: none;
            z-index: -1;
          }
          
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: rgba(26, 26, 26, 0.8);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            border: 1px solid rgba(253, 203, 110, 0.2);
            box-shadow: 
              0 25px 50px -12px rgba(0, 0, 0, 0.5),
              0 0 0 1px rgba(253, 203, 110, 0.1),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
            overflow: hidden;
            position: relative;
          }
          
          .container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(253, 203, 110, 0.5), transparent);
          }
          
          .header {
            background: linear-gradient(135deg, rgba(253, 203, 110, 0.1) 0%, rgba(225, 112, 85, 0.1) 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
            border-bottom: 1px solid rgba(253, 203, 110, 0.2);
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at center, rgba(253, 203, 110, 0.05) 0%, transparent 70%);
            pointer-events: none;
          }
          
          .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 700;
            background: linear-gradient(135deg, #fdcb6e 0%, #e17055 50%, #d63031 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-shadow: 0 0 30px rgba(253, 203, 110, 0.3);
            position: relative;
            z-index: 1;
          }
          
          .content {
            padding: 40px 30px;
            text-align: ${textAlign};
            position: relative;
          }
          
          .greeting {
            font-size: 20px;
            margin-bottom: 25px;
            color: #fdcb6e;
            font-weight: 500;
          }
          
          .message {
            font-size: 16px;
            margin-bottom: 35px;
            color: #e5e5e5;
            line-height: 1.7;
          }
          
          .token-container {
            background: rgba(12, 12, 12, 0.6);
            border: 2px solid rgba(253, 203, 110, 0.3);
            border-radius: 16px;
            padding: 30px;
            text-align: center;
            margin: 35px 0;
            position: relative;
            overflow: hidden;
          }
          
          .token-glow {
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            background: linear-gradient(45deg, #fdcb6e, #e17055, #d63031, #fdcb6e);
            border-radius: 16px;
            opacity: 0.3;
            animation: rotate 3s linear infinite;
            z-index: -1;
          }
          
          .token-border {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 14px;
            background: rgba(12, 12, 12, 0.8);
            z-index: 0;
          }
          
          .token {
            font-size: 36px;
            font-weight: 700;
            color: #fdcb6e;
            letter-spacing: 6px;
            font-family: 'Courier New', monospace;
            margin: 0;
            text-shadow: 0 0 20px rgba(253, 203, 110, 0.5);
            position: relative;
            z-index: 1;
          }
          
          .button-container {
            text-align: center;
            margin: 35px 0;
          }
          
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #fdcb6e 0%, #e17055 100%);
            color: #0c0c0c;
            padding: 18px 40px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            position: relative;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 
              0 10px 25px -5px rgba(253, 203, 110, 0.4),
              0 0 0 1px rgba(253, 203, 110, 0.2);
          }
          
          .button-glow {
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            transition: left 0.5s ease;
          }
          
          .button:hover {
            transform: translateY(-3px) scale(1.05);
            box-shadow: 
              0 20px 40px -10px rgba(253, 203, 110, 0.6),
              0 0 0 1px rgba(253, 203, 110, 0.4);
          }
          
          .button:hover .button-glow {
            left: 100%;
          }
          
          .button-text {
            position: relative;
            z-index: 1;
          }
          
          .summary-container {
            background: rgba(26, 26, 26, 0.6);
            border-radius: 16px;
            padding: 25px;
            margin: 25px 0;
            border: 1px solid rgba(253, 203, 110, 0.2);
            position: relative;
          }
          
          .summary-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
          }
          
          .summary-container h3 {
            margin: 0;
            color: #fdcb6e;
            font-size: 20px;
            font-weight: 600;
          }
          
          .summary-icon {
            font-size: 24px;
            opacity: 0.7;
          }
          
          .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          
          .summary-item {
            background: rgba(12, 12, 12, 0.4);
            padding: 15px;
            border-radius: 10px;
            border: 1px solid rgba(253, 203, 110, 0.1);
          }
          
          .summary-item.full-width {
            grid-column: 1 / -1;
          }
          
          .summary-label {
            font-size: 12px;
            color: #a0a0a0;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
            font-weight: 500;
          }
          
          .summary-value {
            color: #ffffff;
            font-weight: 500;
          }
          
          .priority-high {
            color: #d63031;
            font-weight: 600;
          }
          
          .priority-medium {
            color: #e17055;
            font-weight: 600;
          }
          
          .priority-low {
            color: #fdcb6e;
            font-weight: 600;
          }
          
          .message-content {
            background: rgba(12, 12, 12, 0.6);
            padding: 15px;
            border-radius: 8px;
            margin-top: 8px;
            white-space: pre-wrap;
            border: 1px solid rgba(253, 203, 110, 0.1);
            color: #e5e5e5;
            line-height: 1.6;
          }
          
          .footer {
            background: rgba(12, 12, 12, 0.8);
            padding: 25px 30px;
            text-align: center;
            color: #a0a0a0;
            font-size: 14px;
            border-top: 1px solid rgba(253, 203, 110, 0.2);
            position: relative;
          }
          
          .footer::before {
            content: '';
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 60px;
            height: 1px;
            background: linear-gradient(90deg, transparent, #fdcb6e, transparent);
          }
          
          .signature {
            margin-top: 15px;
            font-style: italic;
            color: #fdcb6e;
            font-weight: 500;
          }
          
          .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(253, 203, 110, 0.3), transparent);
            margin: 25px 0;
          }
          
          @keyframes rotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.6; }
          }
          
          @media (max-width: 600px) {
            body { padding: 10px; }
            .content { padding: 25px 20px; }
            .header { padding: 30px 20px; }
            .header h1 { font-size: 28px; }
            .token { font-size: 28px; letter-spacing: 4px; }
            .summary-grid { grid-template-columns: 1fr; }
            .button { padding: 15px 30px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
          </div>
          <div class="content">
            <div class="greeting">${greeting}</div>
            <div class="message">${message}</div>
            
            ${tokenSection}
            ${buttonSection}
            ${summarySection}
            
            <div class="divider"></div>
            
            <div class="footer">
              <p>${footer}</p>
              <div class="signature">${signature}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
