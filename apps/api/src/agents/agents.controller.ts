import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { AgentsService } from './agents.service.js';
import { AgentRegistryService } from './agent-registry.service.js';

@Controller('agents')
@UseGuards(AdminAuthGuard)
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentRegistry: AgentRegistryService,
  ) {}

  @Get()
  listAgents() {
    return this.agentRegistry.findAll();
  }

  @Post()
  createAgent(@Body() body: unknown) {
    return this.agentRegistry.create(body);
  }

  @Post('demo/run')
  runDemo(@Body() body: { instruction?: unknown }) {
    return this.agentsService.runDemo(body?.instruction);
  }

  @Get('jobs/:id')
  getJob(@Param('id') id: string) {
    return this.agentsService.getJob(id);
  }

  @Get('history')
  getHistory() {
    return this.agentsService.getHistory();
  }

  @Get('history/:id')
  getHistoryById(@Param('id') id: string) {
    return this.agentsService.getHistoryById(id);
  }
}
