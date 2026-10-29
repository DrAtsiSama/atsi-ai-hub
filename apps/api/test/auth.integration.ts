import { configureApp } from '../src/configure-app.js';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('Authentification administrateur réelle', () => {
  it('login, me, logout, session révoquée', async () => {
    const username = process.env.ATSI_TEST_ADMIN_USERNAME;
    const password = process.env.ATSI_TEST_ADMIN_PASSWORD;

    if (!username || !password) {
      throw new Error('Identifiants de test absents');
    }

    process.env.ATSI_ALLOWED_ORIGIN = 'http://localhost:3000';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app: INestApplication = moduleRef.createNestApplication();

    configureApp(app);
    await app.init();

    try {
      const server = app.getHttpServer();

      const login = await request(server)
        .post('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send({ username, password });

      expect(login.status).toBe(201);

      const cookies = login.headers['set-cookie'];
      const cookieHeader = Array.isArray(cookies)
        ? cookies[0]
        : cookies;

      expect(cookieHeader).toContain('atsi_admin_session=');

      const sessionCookie = cookieHeader.split(';')[0];

      const me = await request(server)
        .get('/api/auth/me')
        .set('Cookie', sessionCookie);

      expect(me.status).toBe(200);

      const logout = await request(server)
        .post('/api/auth/logout')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', sessionCookie);

      expect(logout.status).toBe(201);

      const afterLogout = await request(server)
        .get('/api/auth/me')
        .set('Cookie', sessionCookie);

      expect(afterLogout.status).toBe(401);
    } finally {
      await app.close();
    }
  });
});
