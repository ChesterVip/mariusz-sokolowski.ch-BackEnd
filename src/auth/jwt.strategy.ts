import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'change-me'),
    });
  }

  async validate(payload: JwtPayload) {
    const normalizedEmail = payload.email.trim().toLowerCase();
    let user = await this.usersRepository.findOne({ where: { id: payload.sub } });

    if (!user) {
      user = await this.usersRepository.findOne({ where: { email: normalizedEmail } });
      if (user) {
        this.logger.warn(
          `JWT payload referenced missing user id ${payload.sub}. Falling back to email match (${normalizedEmail}).`,
        );
      } else {
        this.logger.warn(
          `JWT payload referenced missing user ${payload.sub} (${normalizedEmail}). Recreating skeleton account.`,
        );
        user = this.usersRepository.create({
          email: normalizedEmail,
        });
        user = await this.usersRepository.save(user);
      }
    }

    return { userId: user.id, email: user.email };
  }
}
