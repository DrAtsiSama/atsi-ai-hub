import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

const SAFE_METHODS = new Set([
  'GET',
  'HEAD',
  'OPTIONS',
]);

@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method)) {
      return true;
    }

    const allowedOrigin = process.env.ATSI_ALLOWED_ORIGIN;

    if (!allowedOrigin) {
      throw new ForbiddenException(
        'Origine autorisée non configurée',
      );
    }

    let normalizedAllowedOrigin: string;

    try {
      normalizedAllowedOrigin = new URL(allowedOrigin).origin;
    } catch {
      throw new ForbiddenException(
        'Configuration de sécurité invalide',
      );
    }

    const origin = request.headers.origin;

    if (
      typeof origin !== 'string' ||
      origin !== normalizedAllowedOrigin
    ) {
      throw new ForbiddenException(
        'Origine de la requête non autorisée',
      );
    }

    return true;
  }
}
