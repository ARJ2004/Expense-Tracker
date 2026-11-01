import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, ErrorResponse, Public, type AuthUser } from '../common';
import { AuthService } from './auth.service';
import { AuthResponse, GoogleSignInDto, LogoutDto, RefreshDto } from './dto/auth.dto';
import { tunables } from '../config/tunables';

/** 10 requests per minute per IP on every auth route. */
@ApiTags('auth')
@Throttle({ default: tunables.rateLimits.auth })
@ApiTooManyRequestsResponse({ type: ErrorResponse })
@ApiBadRequestResponse({ type: ErrorResponse })
@ApiUnauthorizedResponse({ type: ErrorResponse })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'signInWithGoogle', summary: 'Exchange a Google ID token for API tokens' })
  @ApiOkResponse({ type: AuthResponse })
  @ApiServiceUnavailableResponse({ type: ErrorResponse, description: 'AUTH_GOOGLE_NOT_CONFIGURED' })
  google(@Body() dto: GoogleSignInDto): Promise<AuthResponse> {
    return this.auth.signIn(dto.idToken, dto.deviceId);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'refreshTokens', summary: 'Rotate the refresh token and get a new access token' })
  @ApiOkResponse({ type: AuthResponse })
  refresh(@Body() dto: RefreshDto): Promise<AuthResponse> {
    return this.auth.refresh(dto.refreshToken, dto.deviceId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'logout', summary: "Revoke this device's refresh token" })
  @ApiNoContentResponse()
  logout(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto): Promise<void> {
    return this.auth.logout(user.id, dto.refreshToken);
  }
}
