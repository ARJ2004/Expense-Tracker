import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MaxLength, MinLength } from 'class-validator';
import { MeDto } from '../../users';

export class GoogleSignInDto {
  @ApiProperty({ description: 'Google ID token from the app' })
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  idToken: string;

  @ApiProperty({ description: 'Stable per-install id, created on first launch' })
  @IsString()
  @Length(8, 64)
  deviceId: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @Length(16, 128)
  refreshToken: string;

  @ApiProperty()
  @IsString()
  @Length(8, 64)
  deviceId: string;
}

export class LogoutDto {
  @ApiProperty()
  @IsString()
  @Length(16, 128)
  refreshToken: string;
}

export class AuthResponse {
  @ApiProperty({ description: 'Bearer token for API calls' })
  accessToken: string;

  @ApiProperty({ description: 'Single-use; swap it at /auth/refresh before the access token expires' })
  refreshToken: string;

  @ApiProperty({ type: 'integer', example: 900, description: 'Access token lifetime in seconds' })
  expiresIn: number;

  @ApiProperty({ type: MeDto })
  user: MeDto;
}
