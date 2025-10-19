import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { SecureController } from './secure.controller';

@Module({
  imports: [ConfigModule, PassportModule],
  controllers: [SecureController],
})
export class SecureModule {}
