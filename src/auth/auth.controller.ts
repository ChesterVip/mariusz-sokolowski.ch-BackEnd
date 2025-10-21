import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RequestLoginCodeDto } from './dto/request-login-code.dto';
import { VerifyLoginCodeDto } from './dto/verify-login-code.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-code')
  @Throttle({ default: { limit: 5, ttl: 60 * 1000 } }) // 5 requestów na minutę
  @HttpCode(HttpStatus.ACCEPTED)
  async requestCode(@Body() dto: RequestLoginCodeDto, @Req() req: Request) {
    const metadata = {
      firstName: dto.firstName?.trim(),
      lastName: dto.lastName?.trim(),
      phone: dto.phone?.trim(),
      company: dto.company?.trim(),
      language: dto.language?.trim() ?? this.extractLanguageFromHeader(req.headers['accept-language']),
      country: dto.country?.trim() ?? this.extractCountryFromHeaders(req),
      deviceType: dto.deviceType?.trim(),
      browserName: dto.browserName?.trim(),
      browserVersion: dto.browserVersion?.trim(),
      osName: dto.osName?.trim(),
      osVersion: dto.osVersion?.trim(),
      userAgent: req.headers['user-agent'],
      ipAddress: this.extractClientIp(req),
    };

    const result = await this.authService.requestLoginCode(
      dto.email,
      dto.refreshUrl,
      metadata,
    );

    return { 
      message: result.existingTokenValid
        ? 'Posiadasz już aktywny token. Przesłaliśmy go ponownie na Twój adres e-mail.'
        : 'Jeśli użytkownik istnieje, kod został wysłany.',
      codeSent: result.codeSent,
      existingTokenValid: result.existingTokenValid,
      validUntil: result.validUntil?.toISOString(),
      resentExistingToken: result.resentExistingToken ?? false,
    };
  }

  @Post('verify')
  @Throttle({ default: { limit: 6, ttl: 60 * 1000 } })
  async verify(@Body() dto: VerifyLoginCodeDto) {
    return this.authService.verifyLoginCode(dto.email, dto.code);
  }

  private extractClientIp(req: Request): string | undefined {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (Array.isArray(xForwardedFor)) {
      return xForwardedFor[0];
    }
    if (typeof xForwardedFor === 'string') {
      const [firstIp] = xForwardedFor.split(',').map((ip) => ip.trim());
      if (firstIp) {
        return firstIp;
      }
    }
    return req.ip;
  }

  private extractLanguageFromHeader(headerValue: string | string[] | undefined): string | undefined {
    if (!headerValue) {
      return undefined;
    }
    const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const [primary] = value.split(',').map((lang) => lang.trim());
    return primary?.slice(0, 5);
  }

  private extractCountryFromHeaders(req: Request): string | undefined {
    const cloudflareCountry = req.headers['cf-ipcountry'];
    if (typeof cloudflareCountry === 'string' && cloudflareCountry.length > 0) {
      return cloudflareCountry.toUpperCase();
    }
    const geoCountry = req.headers['x-country-code'];
    if (typeof geoCountry === 'string' && geoCountry.length > 0) {
      return geoCountry.toUpperCase();
    }
    return undefined;
  }
}
