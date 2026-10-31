import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenService } from './token.service';
import { DevIdTokenVerifier } from './verifiers/dev-id-token.verifier';
import { GoogleIdTokenVerifier } from './verifiers/google-id-token.verifier';
import { ID_TOKEN_VERIFIERS, type IdTokenVerifier } from './verifiers/id-token-verifier';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    DevIdTokenVerifier,
    GoogleIdTokenVerifier,
    {
      // Order matters: the dev verifier only claims "dev:" tokens, Google takes everything else.
      provide: ID_TOKEN_VERIFIERS,
      inject: [DevIdTokenVerifier, GoogleIdTokenVerifier],
      useFactory: (...verifiers: IdTokenVerifier[]) => verifiers,
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
