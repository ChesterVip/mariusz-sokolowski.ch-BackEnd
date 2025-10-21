import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { SubmitContactDto } from './dto/submit-contact.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly mailService: MailService) {}

  async handleContactSubmission(dto: SubmitContactDto): Promise<void> {
    const submission = {
      ...dto,
      submittedAt: new Date(),
    };

    await this.mailService.sendContactFormNotification(submission);

    try {
      await this.mailService.sendContactFormAcknowledgement(submission);
    } catch (error) {
      const reason = error instanceof Error ? error.stack ?? error.message : String(error);
      this.logger.warn(`Failed to send acknowledgement email: ${reason}`);
    }
  }
}
