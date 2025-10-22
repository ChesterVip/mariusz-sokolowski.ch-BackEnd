import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { ContactModule } from './contact/contact.module';
import { MailModule } from './mail/mail.module';
import { SecureModule } from './secure/secure.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      ignoreEnvFile: false,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ttlSeconds = config.get<number>('RATE_LIMIT_TTL_SECONDS', 60);
        const limit = config.get<number>('RATE_LIMIT_MAX_REQUESTS', 10);
        return [
          {
            ttl: ttlSeconds * 1000,
            limit,
          },
        ];
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'sqlite',
        database: config.get<string>('DATABASE_URL', './data/app.db'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: config.get<boolean>('TYPEORM_RUN_MIGRATIONS', true),
        migrations: [join(__dirname, 'database/migrations/*{.ts,.js}')],
        logging: config.get<boolean>('DATABASE_LOGGING', false),
      }),
    }),
    MailModule,
    UsersModule,
    AuthModule,
    SecureModule,
    HealthModule,
    ContactModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
