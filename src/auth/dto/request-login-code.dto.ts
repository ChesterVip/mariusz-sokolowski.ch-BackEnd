import { IsEmail, IsOptional, IsUrl } from 'class-validator';

export class RequestLoginCodeDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  refreshUrl?: string;
}
