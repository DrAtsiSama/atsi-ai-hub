import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { AgentsController } from './agents.controller.js';
import { AgentsService } from './agents.service.js';
import { AgentRegistryService } from './agent-registry.service.js';
import { AgentExecutionPolicyService } from './agent-execution-policy.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AgentsController],
  providers: [
    AgentsService,
    AgentRegistryService,
    AgentExecutionPolicyService,
    AdminAuthGuard,
  ],
})
export class AgentsModule {}
