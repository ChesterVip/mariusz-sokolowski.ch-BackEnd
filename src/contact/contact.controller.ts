import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { SubmitContactDto } from './dto/submit-contact.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60 * 1000 } })
  async submit(@Body() dto: SubmitContactDto) {
    await this.contactService.handleContactSubmission(dto);
    return {
      message:
        'Dziękujemy za wiadomość! Odpowiemy na nią tak szybko, jak to możliwe.',
    };
  }
}
