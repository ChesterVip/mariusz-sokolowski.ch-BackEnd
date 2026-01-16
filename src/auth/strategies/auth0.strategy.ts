import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-auth0';

@Injectable()
export class Auth0Strategy extends PassportStrategy(Strategy, 'auth0') {
  private readonly logger = new Logger(Auth0Strategy.name);

  constructor(private readonly configService: ConfigService) {
    super({
      domain: configService.get<string>('AUTH0_DOMAIN') || '',
      clientID: configService.get<string>('AUTH0_CLIENT_ID') || '',
      clientSecret: configService.get<string>('AUTH0_CLIENT_SECRET') || '',
      callbackURL: configService.get<string>('AUTH0_CALLBACK_URL') || '',
    } as any);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    extraParams: any,
    profile: Profile,
    done: (error: any, user?: any) => void,
  ): Promise<any> {
    const { id, displayName, emails, photos, provider } = profile;

    // Parsuj displayName na firstName i lastName
    const nameParts = displayName?.split(' ') || [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const user = {
      provider: provider || 'auth0',
      providerId: id,
      email: emails?.[0]?.value,
      firstName: firstName,
      lastName: lastName,
      picture: photos?.[0]?.value,
      accessToken,
    };

    this.logger.log(`Auth0 login successful for email: ${user.email}`);
    done(null, user);
  }
}
