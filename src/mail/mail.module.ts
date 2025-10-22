import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailjetService } from './mailjet.service';

@Module({
  providers: [MailService, MailjetService],
  exports: [MailService, MailjetService],
})
export class MailModule {}
