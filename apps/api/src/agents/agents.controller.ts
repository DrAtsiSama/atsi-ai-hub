import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AgentsService } from './agents.service.js';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

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
