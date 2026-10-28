import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import {
  generateSessionToken,
  hashSessionToken,
  verifyPassword,
} from './auth.crypto.js';

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

interface AdminUser {
  id: string;
  username: string;
  password_hash: string;
  is_active: boolean;
}

export interface SessionUser {
  id: string;
  username: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  async login(username: string, password: string) {
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      username.length > 128 ||
      password.length > 1024
    ) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const result = await this.database.query<AdminUser>(
      `SELECT id, username, password_hash, is_active
       FROM admin_users
       WHERE username = $1
       LIMIT 1`,
      [username],
    );

    const admin = result.rows[0];

    if (
      !admin ||
      !admin.is_active ||
      !(await verifyPassword(password, admin.password_hash))
    ) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await this.database.query(
      `INSERT INTO admin_sessions (
        id, admin_user_id, token_hash, expires_at
      ) VALUES ($1, $2, $3, $4)`,
      [
        randomUUID(),
        admin.id,
        hashSessionToken(token),
        expiresAt,
      ],
    );

    return {
      token,
      expiresAt,
      user: {
        id: admin.id,
        username: admin.username,
      },
    };
  }

  async getSessionUser(token: string): Promise<SessionUser> {
    if (
      typeof token !== 'string' ||
      !/^[0-9a-f]{64}$/.test(token)
    ) {
      throw new UnauthorizedException('Session invalide');
    }

    const result = await this.database.query<SessionUser>(
      `SELECT u.id, u.username
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.admin_user_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
         AND u.is_active = TRUE
       LIMIT 1`,
      [hashSessionToken(token)],
    );

    if (!result.rows[0]) {
      throw new UnauthorizedException('Session expirée ou invalide');
    }

    return result.rows[0];
  }

  async logout(token: string): Promise<void> {
    if (
      typeof token !== 'string' ||
      !/^[0-9a-f]{64}$/.test(token)
    ) {
      return;
    }

    await this.database.query(
      `UPDATE admin_sessions
       SET revoked_at = NOW()
       WHERE token_hash = $1
         AND revoked_at IS NULL`,
      [hashSessionToken(token)],
    );
  }
}
