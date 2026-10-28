import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginRateLimitService } from './login-rate-limit.service.js';

const COOKIE_NAME = 'atsi_admin_session';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

function readSessionCookie(request: Request): string | undefined {
  const header = request.headers.cookie;

  if (!header) {
    return undefined;
  }

  const cookie = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));

  return cookie?.slice(COOKIE_NAME.length + 1);
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: SESSION_DURATION_MS,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimit: LoginRateLimitService,
  ) {}

  @Post('login')
  async login(
    @Body() body: { username?: unknown; password?: unknown },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const username =
      typeof body?.username === 'string'
        ? body.username
        : '';

    const password =
      typeof body?.password === 'string'
        ? body.password
        : '';

    const ip = request.socket.remoteAddress ?? 'unknown';

    await this.rateLimit.reserveAttempt(ip, username);

    const { token, user, expiresAt } =
      await this.authService.login(username, password);

    response.cookie(COOKIE_NAME, token, cookieOptions());

    return {
      authenticated: true,
      user,
      expiresAt,
    };
  }

  @Get('me')
  async me(@Req() request: Request) {
    const token = readSessionCookie(request);

    if (!token) {
      throw new UnauthorizedException('Session absente');
    }

    const user = await this.authService.getSessionUser(token);

    return {
      authenticated: true,
      user,
    };
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = readSessionCookie(request);

    if (token) {
      await this.authService.logout(token);
    }

    response.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return { authenticated: false };
  }
}
