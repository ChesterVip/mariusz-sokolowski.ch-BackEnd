import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RequestLoginCodeDto } from './dto/request-login-code.dto';
import { VerifyLoginCodeDto } from './dto/verify-login-code.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-code')
  @Throttle(3, 5 * 60 * 1000)
  @HttpCode(HttpStatus.ACCEPTED)
  async requestCode(@Body() dto: RequestLoginCodeDto) {
    await this.authService.requestLoginCode(dto.email, dto.refreshUrl);
    return { message: 'Jeśli użytkownik istnieje, kod został wysłany.' };
  }

  @Post('verify')
  @Throttle(6, 60 * 1000)
  async verify(@Body() dto: VerifyLoginCodeDto) {
    return this.authService.verifyLoginCode(dto.email, dto.code);
  }
}
