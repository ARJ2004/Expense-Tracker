import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const WAITLIST_SOURCES = ['download', 'home', 'features', 'compare', 'about'] as const;
export type WaitlistSource = (typeof WAITLIST_SOURCES)[number];

const normalizeEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const blankToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class JoinWaitlistDto {
  @ApiProperty({ example: 'you@example.com', maxLength: 254 })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ enum: WAITLIST_SOURCES, description: 'The page the form was on' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(WAITLIST_SOURCES)
  source?: WaitlistSource;

  /**
   * Honeypot: hidden from people, so only bots fill it in. A filled one gets the same 202 as
   * everyone else and is dropped, so the bot learns nothing.
   */
  @ApiPropertyOptional({ description: 'Leave empty' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;
}

export class WaitlistAcceptedDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status: 'ok';
}
