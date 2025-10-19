import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { LoginToken } from './entities/login-token.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';

interface GenerateLoginTokenOptions {
  sendEmail?: boolean;
  refreshUrl?: string;
}

interface VerifyResult {
  accessToken: string;
  expiresAt: Date;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly tokenTtlMs: number;

  constructor(
    @InjectRepository(LoginToken)
    private readonly loginTokenRepository: Repository<LoginToken>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {
    const ttlHours = this.config.get<number>('LOGIN_CODE_TTL_HOURS', 24);
    this.tokenTtlMs = ttlHours * 60 * 60 * 1000;
  }

  async generateLoginToken(
    user: User,
    options: GenerateLoginTokenOptions = {},
  ): Promise<LoginToken> {
    await this.loginTokenRepository
      .createQueryBuilder()
      .update()
      .set({ revoked: true })
      .where('userId = :userId', { userId: user.id })
      .andWhere('revoked = :revoked', { revoked: false })
      .andWhere('consumedAt IS NULL')
      .execute();

    const code = await this.createUniqueCode();
    const token = this.loginTokenRepository.create({
      code,
      expiresAt: new Date(Date.now() + this.tokenTtlMs),
      user,
      userId: user.id,
    });

    const savedToken = await this.loginTokenRepository.save(token);

    if (options.sendEmail) {
      await this.mailService.sendLoginTokenEmail({
        to: user.email,
        code,
        expiresAt: savedToken.expiresAt,
        refreshUrl: options.refreshUrl,
      });
    }

    return savedToken;
  }

  async requestLoginCode(email: string, refreshUrl?: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      this.logger.warn(`Login code requested for unknown email: ${email}`);
      return;
    }

    await this.generateLoginToken(user, {
      sendEmail: true,
      refreshUrl,
    });
  }

  async verifyLoginCode(email: string, code: string): Promise<VerifyResult> {
    const user = await this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Nieprawidłowy kod lub e-mail.');
    }

    const loginToken = await this.loginTokenRepository.findOne({
      where: {
        userId: user.id,
        code,
        revoked: false,
      },
    });

    if (!loginToken) {
      throw new UnauthorizedException('Nieprawidłowy kod lub e-mail.');
    }

    if (loginToken.consumedAt) {
      throw new UnauthorizedException('Kod został już wykorzystany.');
    }

    if (loginToken.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Kod wygasł.');
    }

    loginToken.consumedAt = new Date();
    loginToken.revoked = true;
    await this.loginTokenRepository.save(loginToken);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const expiresIn = `${this.config.get<number>('LOGIN_CODE_TTL_HOURS', 24)}h`;
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn,
    });

    return {
      accessToken,
      expiresAt: new Date(Date.now() + this.tokenTtlMs),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  private async createUniqueCode(): Promise<string> {
    const maxTries = 10;
    for (let attempt = 0; attempt < maxTries; attempt += 1) {
      const code = this.generateCode();
      const exists = await this.loginTokenRepository.exists({
        where: { code },
      });
      if (!exists) {
        return code;
      }
    }

    this.logger.warn('Falling back to extended code generation after collisions.');
    return this.generateCode(8);
  }

  private generateCode(length = 6): string {
    let code = '';
    while (code.length < length) {
      code += randomInt(0, 10).toString();
    }
    return code;
  }
}
