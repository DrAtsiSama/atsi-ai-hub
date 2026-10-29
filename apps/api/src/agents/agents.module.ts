import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { AgentsController } from './agents.controller.js';
import { AgentsService } from './agents.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AgentsController],
  providers: [AgentsService, AdminAuthGuard],
})
export class AgentsModule {}
