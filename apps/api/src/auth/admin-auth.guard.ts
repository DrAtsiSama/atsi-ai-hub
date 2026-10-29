import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';

const COOKIE_NAME = 'atsi_admin_session';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieHeader = request.headers.cookie;

    if (!cookieHeader) {
      throw new UnauthorizedException('Authentification requise');
    }

    const cookie = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_NAME}=`));

    const token = cookie?.slice(COOKIE_NAME.length + 1);

    if (!token) {
      throw new UnauthorizedException('Session absente');
    }

    const user = await this.authService.getSessionUser(token);

    if (!user) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    return true;
  }
}
