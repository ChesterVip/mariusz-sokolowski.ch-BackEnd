import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

@Controller('secure')
export class SecureController {
  constructor(private readonly config: ConfigService) {}

  @Get('contact')
  @UseGuards(AuthGuard('jwt'))
  getContact() {
    const getString = (key: string, fallback: string) => {
      const value = this.config.get<string>(key)?.trim();
      return value && value.length > 0 ? value : fallback;
    };

    return {
      email: getString('CONTACT_EMAIL', 'kontakt@mariusz-sokolowski.ch'),
      phone: getString('CONTACT_PHONE', '+41 76 237 33 01'),
      whatsapp: getString('CONTACT_WHATSAPP', '+41 76 237 33 01'),
      facebook: getString('CONTACT_FACEBOOK', 'https://www.facebook.com/mariusz.sokolowski.94'),
    };
  }
}
