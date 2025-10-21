import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RequestLoginCodeDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\d+\s()-]{5,20}$/, {
    message:
      'Numer telefonu powinien mieć 5-20 znaków i może zawierać cyfry, spacje, plus, nawiasy lub myślniki.',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  company?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  refreshUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  deviceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  browserName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  browserVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  osName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  osVersion?: string;
}
