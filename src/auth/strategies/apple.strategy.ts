import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-apple';

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  private readonly logger = new Logger(AppleStrategy.name);

  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('APPLE_CLIENT_ID') || '',
      teamID: configService.get<string>('APPLE_TEAM_ID') || '',
      keyID: configService.get<string>('APPLE_KEY_ID') || '',
      privateKeyLocation: configService.get<string>('APPLE_PRIVATE_KEY_PATH') || '',
      callbackURL: configService.get<string>('APPLE_CALLBACK_URL') || '',
      scope: ['email', 'name'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    idToken: any,
    profile: any,
    done: (error: any, user?: any, info?: any) => void,
  ): Promise<any> {
    const user = {
      provider: 'apple',
      providerId: profile.id,
      email: profile.email,
      firstName: profile.name?.firstName,
      lastName: profile.name?.lastName,
      accessToken,
    };

    this.logger.log(`Apple OAuth successful for email: ${user.email}`);
    done(null, user);
  }
}
