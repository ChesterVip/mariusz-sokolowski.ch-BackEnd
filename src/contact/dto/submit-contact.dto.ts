import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum ContactCategory {
  GENERAL = 'general',
  BUSINESS = 'business',
  TECHNICAL = 'technical',
  COLLABORATION = 'collaboration',
  RECRUITMENT = 'recruitment',
}

export enum ContactPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum PreferredContactMethod {
  EMAIL = 'email',
  PHONE = 'phone',
  BOTH = 'both',
}

export class SubmitContactDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\+]?[1-9][\d\s()-]{4,19}$/, {
    message:
      'Numer telefonu powinien mieć 5-20 znaków i może zawierać cyfry, spacje, plus, nawiasy lub myślniki.',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  company?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;

  @IsEnum(ContactCategory)
  category!: ContactCategory;

  @IsEnum(ContactPriority)
  priority!: ContactPriority;

  @IsEnum(PreferredContactMethod)
  preferredContact!: PreferredContactMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  budget?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timeline?: string;

  @IsBoolean()
  @Equals(true, { message: 'Wymagana jest zgoda na przetwarzanie danych.' })
  gdprConsent!: boolean;

  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}
