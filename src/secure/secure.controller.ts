import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

@Controller('secure')
export class SecureController {
  constructor(private readonly config: ConfigService) {}

  @Get('contact')
  @UseGuards(AuthGuard('jwt'))
  getContact() {
    return {
      email: this.config.get<string>('CONTACT_EMAIL'),
      phone: this.config.get<string>('CONTACT_PHONE'),
      whatsapp: this.config.get<string>('CONTACT_WHATSAPP'),
      facebook: this.config.get<string>('CONTACT_FACEBOOK'),
    };
  }
}
