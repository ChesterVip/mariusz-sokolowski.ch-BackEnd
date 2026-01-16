import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService, OAuthUser } from './auth.service';
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

  // OAuth Google
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: Request) {
    // Przekierowanie do Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const oauthUser = req.user as OAuthUser;
    const result = await this.authService.validateOAuthLogin(oauthUser);

    // Przekieruj do frontendu z tokenem
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(
      `${frontendUrl}/auth/callback?token=${result.accessToken}&email=${result.user.email}`,
    );
  }

  // OAuth Facebook
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuth(@Req() req: Request) {
    // Przekierowanie do Facebook
  }

  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const oauthUser = req.user as OAuthUser;
    const result = await this.authService.validateOAuthLogin(oauthUser);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(
      `${frontendUrl}/auth/callback?token=${result.accessToken}&email=${result.user.email}`,
    );
  }

  // OAuth Apple
  @Get('apple')
  @UseGuards(AuthGuard('apple'))
  async appleAuth(@Req() req: Request) {
    // Przekierowanie do Apple
  }

  @Get('apple/callback')
  @UseGuards(AuthGuard('apple'))
  async appleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const oauthUser = req.user as OAuthUser;
    const result = await this.authService.validateOAuthLogin(oauthUser);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(
      `${frontendUrl}/auth/callback?token=${result.accessToken}&email=${result.user.email}`,
    );
  }

  // Auth0 Universal Login
  @Get('auth0')
  @UseGuards(AuthGuard('auth0'))
  async auth0Login(@Req() req: Request) {
    // Przekierowanie do Auth0 Universal Login
  }

  @Get('auth0/callback')
  @UseGuards(AuthGuard('auth0'))
  async auth0Callback(@Req() req: Request, @Res() res: Response) {
    const oauthUser = req.user as OAuthUser;
    const result = await this.authService.validateOAuthLogin(oauthUser);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(
      `${frontendUrl}/auth/callback?token=${result.accessToken}&email=${result.user.email}`,
    );
  }
}
