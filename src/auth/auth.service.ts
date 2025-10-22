import {
  BadRequestException,
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
  language?: string;
  metadata?: LoginCodeRequestMetadata;
  issuedAt?: Date;
}

interface LoginCodeRequestMetadata {
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  language?: string;
  country?: string;
  deviceType?: string;
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  osVersion?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface VerifyResult {
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
        language: options.language ?? user.preferredLanguage ?? 'pl',
        isReminder: false,
        issuedAt: options.issuedAt ?? savedToken.createdAt ?? new Date(),
        metadata: options.metadata,
      });
    }

    return savedToken;
  }

  async requestLoginCode(
    email: string,
    refreshUrl?: string,
    metadata?: LoginCodeRequestMetadata,
  ): Promise<{
    codeSent: boolean;
    existingTokenValid: boolean;
    validUntil?: Date;
    resentExistingToken?: boolean;
  }> {
    const normalizedEmail = this.normalizeEmail(email);
    let user = await this.usersRepository.findOne({
      where: { email: normalizedEmail },
    });

    const sanitizedMetadata: LoginCodeRequestMetadata | undefined = metadata
      ? {
          firstName: metadata.firstName?.trim() || undefined,
          lastName: metadata.lastName?.trim() || undefined,
          phone: metadata.phone?.trim() || undefined,
          company: metadata.company?.trim() || undefined,
          language: metadata.language?.trim().toLowerCase() || undefined,
          country: metadata.country?.trim() || undefined,
          deviceType: metadata.deviceType?.trim() || undefined,
          browserName: metadata.browserName?.trim() || undefined,
          browserVersion: metadata.browserVersion?.trim() || undefined,
          osName: metadata.osName?.trim() || undefined,
          osVersion: metadata.osVersion?.trim() || undefined,
          userAgent: metadata.userAgent?.trim() || undefined,
          ipAddress: metadata.ipAddress?.trim() || undefined,
        }
      : undefined;

    // Jeśli użytkownik nie istnieje, utwórz go automatycznie
    if (!user && sanitizedMetadata?.firstName && sanitizedMetadata?.lastName) {
      try {
        user = this.usersRepository.create({
          email: normalizedEmail,
          firstName: sanitizedMetadata.firstName,
          lastName: sanitizedMetadata.lastName,
          preferredLanguage: sanitizedMetadata.language ?? 'pl',
        });
        user = await this.usersRepository.save(user);
        this.logger.log(`Automatically created new user: ${normalizedEmail}`);
      } catch (error) {
        this.logger.error(`Failed to create user ${normalizedEmail}:`, error);
        throw new Error('Nie udało się utworzyć konta użytkownika.');
      }
    }

    if (!user) {
      this.logger.warn(`Login code requested for unknown email without metadata: ${email}`);
      throw new BadRequestException(
        'Nie znaleziono konta dla podanego adresu. Wybierz opcję „Uzyskaj kod dla nowego użytkownika” i wypełnij formularz.',
      );
    }

    if (sanitizedMetadata) {
      const updates: Partial<User> = {};

      if (sanitizedMetadata.firstName && sanitizedMetadata.firstName !== user.firstName) {
        updates.firstName = sanitizedMetadata.firstName;
      }

      if (sanitizedMetadata.lastName && sanitizedMetadata.lastName !== user.lastName) {
        updates.lastName = sanitizedMetadata.lastName;
      }

      if (Object.keys(updates).length > 0) {
        await this.usersRepository.update(user.id, updates);
        user = { ...user, ...updates };
        this.logger.log(`Updated profile information for user: ${normalizedEmail}`);
      }
    }

    const preferredLanguage =
      sanitizedMetadata?.language ??
      user.preferredLanguage ??
      this.config.get<string>('DEFAULT_USER_LANGUAGE', 'pl');

    if (sanitizedMetadata?.language && sanitizedMetadata.language !== user.preferredLanguage) {
      await this.usersRepository.update(user.id, {
        preferredLanguage: sanitizedMetadata.language,
      });
      user.preferredLanguage = sanitizedMetadata.language;
    }

    // Sprawdź czy istnieje ważny token
    const existingToken = await this.loginTokenRepository.findOne({
      where: {
        userId: user.id,
        revoked: false,
        consumedAt: undefined,
      },
    });

    // Jeśli token istnieje i jest ważny, nie wysyłaj nowego
    const now = Date.now();
    if (existingToken && existingToken.expiresAt.getTime() > now) {
      this.logger.log(`Valid token already exists for user: ${normalizedEmail}`);
      try {
        await this.mailService.sendLoginTokenEmail({
          to: user.email,
          code: existingToken.code,
          expiresAt: existingToken.expiresAt,
          refreshUrl,
          language: preferredLanguage ?? 'pl',
          isReminder: true,
          issuedAt: existingToken.createdAt,
          metadata: sanitizedMetadata,
        });

        await this.mailService.sendAccessRequestNotification({
          requesterEmail: normalizedEmail,
          userExists: true,
          action: 'token-reminder',
          tokenExpiresAt: existingToken.expiresAt,
          tokenIssuedAt: existingToken.createdAt,
          metadata: sanitizedMetadata,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.stack ?? error.message : String(error);
        this.logger.error('Failed to send reminder email for existing token', reason);
      }

      return {
        codeSent: false,
        existingTokenValid: true,
        validUntil: existingToken.expiresAt,
        resentExistingToken: true,
      };
    }

    // Wygeneruj nowy token
    const newToken = await this.generateLoginToken(user, {
      sendEmail: true,
      refreshUrl,
      language: preferredLanguage ?? 'pl',
      metadata: sanitizedMetadata,
    });

    try {
      await this.mailService.sendAccessRequestNotification({
        requesterEmail: normalizedEmail,
        userExists: true,
        action: 'new-token',
        tokenExpiresAt: newToken.expiresAt,
        tokenIssuedAt: newToken.createdAt,
        metadata: sanitizedMetadata,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.stack ?? error.message : String(error);
      this.logger.error('Failed to send access request notification email', reason);
    }

    return {
      codeSent: true,
      existingTokenValid: false,
      validUntil: newToken.expiresAt,
      resentExistingToken: false,
    };
  }

  async verifyLoginCode(email: string, code: string): Promise<VerifyResult> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.usersRepository.findOne({
      where: { email: normalizedEmail },
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

    const expiresIn = Math.floor(this.tokenTtlMs / 1000);
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

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }
}
