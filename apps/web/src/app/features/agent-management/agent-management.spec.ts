import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AgentManagement } from './agent-management';
import { AgentsService } from '../../core/agents/agents.service';
import {
  CreateAgentRequest,
  RegisteredAgent,
} from '../../core/agents/agents.models';

describe('AgentManagement', () => {
  const exampleAgent: RegisteredAgent = {
    id: 'agent-123',
    key: 'employment-agent',
    name: 'Agent Emploi',
    description: 'Analyse les offres d’emploi',
    type: 'employment',
    enabled: false,
    config: {},
    configVersion: 1,
    capabilities: ['employment.offers.analyze'],
    requiresApproval: true,
    createdAt: '2026-11-05T14:00:00Z',
    updatedAt: '2026-11-05T14:00:00Z',
  };

  let agentsService: {
    getAgents: ReturnType<typeof vi.fn>;
    createAgent: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    agentsService = {
      getAgents: vi.fn().mockReturnValue(of([])),
      createAgent: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AgentManagement],
      providers: [
        provideRouter([]),
        {
          provide: AgentsService,
          useValue: agentsService,
        },
      ],
    }).compileComponents();
  });

  it('charge les agents au démarrage', () => {
    agentsService.getAgents.mockReturnValue(of([exampleAgent]));

    const fixture = TestBed.createComponent(AgentManagement);
    fixture.detectChanges();

    const component = fixture.componentInstance;

    expect(agentsService.getAgents).toHaveBeenCalledOnce();
    expect(component.loaded()).toBe(true);
    expect(component.total()).toBe(1);
    expect(component.enabled()).toBe(0);
    expect(component.agents()[0].key).toBe('employment-agent');
  });

  it('crée un agent et actualise le registre', () => {
    agentsService.createAgent.mockReturnValue(of(exampleAgent));

    const fixture = TestBed.createComponent(AgentManagement);
    fixture.detectChanges();

    const component = fixture.componentInstance;

    component.name = 'Agent Emploi';
    component.key = 'employment-agent';
    component.description = 'Analyse les offres';
    component.type = 'employment';
    component.selectedCapabilities = ['employment.offers.analyze'];

    component.createAgent();

    expect(agentsService.createAgent).toHaveBeenCalledOnce();

    const request = agentsService.createAgent.mock.calls[0][0] as CreateAgentRequest;

    expect(request).toEqual({
      key: 'employment-agent',
      name: 'Agent Emploi',
      description: 'Analyse les offres',
      type: 'employment',
      config: {},
      capabilities: ['employment.offers.analyze'],
    });

    expect(component.total()).toBe(1);
    expect(component.createSuccess()).toContain('succès');
    expect(component.creating()).toBe(false);
    expect(component.key).toBe('');
    expect(component.selectedCapabilities).toEqual([]);
  });

  it('refuse une clé invalide avant tout appel API', () => {
    const fixture = TestBed.createComponent(AgentManagement);
    fixture.detectChanges();

    const component = fixture.componentInstance;

    component.name = 'Agent invalide';
    component.key = 'Agent_Invalide';

    component.createAgent();

    expect(agentsService.createAgent).not.toHaveBeenCalled();
    expect(component.createError()).toContain('clé');
  });

  it('affiche une erreur lorsque la clé existe déjà', () => {
    agentsService.createAgent.mockReturnValue(
      throwError(() => ({ status: 409 })),
    );

    const fixture = TestBed.createComponent(AgentManagement);
    fixture.detectChanges();

    const component = fixture.componentInstance;

    component.name = 'Agent Emploi';
    component.key = 'employment-agent';

    component.createAgent();

    expect(component.createError()).toContain('déjà utilisée');
    expect(component.creating()).toBe(false);
    expect(component.total()).toBe(0);
  });

  it('réinitialise les capacités lors du changement de type', () => {
    const fixture = TestBed.createComponent(AgentManagement);
    fixture.detectChanges();

    const component = fixture.componentInstance;

    component.selectedCapabilities = ['employment.offers.analyze'];
    component.type = 'portfolio';

    component.onTypeChange();

    expect(component.selectedCapabilities).toEqual([]);
    expect(component.availableCapabilities()).toEqual([
      'portfolio.content.read',
      'portfolio.drafts.prepare',
    ]);
  });
});
