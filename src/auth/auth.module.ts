import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginToken } from './entities/login-token.entity';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { AppleStrategy } from './strategies/apple.strategy';
import { Auth0Strategy } from './strategies/auth0.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    MailModule,
    TypeOrmModule.forFeature([LoginToken, User]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'change-me'),
        signOptions: {
          expiresIn: `${config.get<number>('LOGIN_CODE_TTL_HOURS', 24)}h`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, Auth0Strategy, GoogleStrategy, FacebookStrategy, AppleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
