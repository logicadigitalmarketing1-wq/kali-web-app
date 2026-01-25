import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { TotpService } from './totp.service';
import { AuthGuard } from './auth.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, TotpService, AuthGuard],
  exports: [AuthService, SessionService, AuthGuard],
})
export class AuthModule {}
