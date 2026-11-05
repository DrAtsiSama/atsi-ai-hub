import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AgentsService } from '../../core/agents/agents.service';
import { AgentCapability, AgentType, CreateAgentRequest, RegisteredAgent } from '../../core/agents/agents.models';

@Component({
  selector: 'app-agent-management',
  imports: [RouterLink, FormsModule],
  templateUrl: './agent-management.html',
  styleUrl: './agent-management.scss',
})
export class AgentManagement implements OnInit {
  private readonly agentsService = inject(AgentsService);

  readonly agents = signal<RegisteredAgent[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');

  readonly creating = signal(false);
  readonly createError = signal('');
  readonly createSuccess = signal('');

  name = '';
  key = '';
  description = '';
  type: AgentType = 'employment';
  selectedCapabilities: AgentCapability[] = [];

  readonly capabilitiesByType: Record<AgentType, AgentCapability[]> = {
    system: ['demo.execute'],
    employment: [
      'employment.applications.read',
      'employment.applications.organize',
      'employment.offers.analyze',
      'employment.drafts.prepare',
    ],
    portfolio: [
      'portfolio.content.read',
      'portfolio.drafts.prepare',
    ],
  };

  availableCapabilities(): AgentCapability[] {
    return this.capabilitiesByType[this.type];
  }

  onTypeChange(): void {
    this.selectedCapabilities = [];
  }

  isCapabilitySelected(capability: AgentCapability): boolean {
    return this.selectedCapabilities.includes(capability);
  }

  toggleCapability(capability: AgentCapability, checked: boolean): void {
    if (checked) {
      if (!this.selectedCapabilities.includes(capability)) {
        this.selectedCapabilities = [...this.selectedCapabilities, capability];
      }
    } else {
      this.selectedCapabilities =
        this.selectedCapabilities.filter(item => item !== capability);
    }
  }

  createAgent(): void {
    if (this.creating()) return;

    this.createError.set('');
    this.createSuccess.set('');

    const key = this.key.trim();

    if (!/^[a-z][a-z0-9-]*$/.test(key) || key.length > 100) {
      this.createError.set(
        'La clé doit commencer par une lettre minuscule et contenir uniquement des lettres minuscules, chiffres ou tirets.',
      );
      return;
    }

    if (!this.name.trim() || this.name.length > 150) {
      this.createError.set('Le nom est obligatoire (150 caractères maximum).');
      return;
    }

    if (this.description.length > 2000) {
      this.createError.set('La description dépasse 2000 caractères.');
      return;
    }

    const request: CreateAgentRequest = {
      key,
      name: this.name.trim(),
      description: this.description,
      type: this.type,
      config: {},
      capabilities: [...this.selectedCapabilities],
    };

    this.creating.set(true);

    this.agentsService.createAgent(request)
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        next: agent => {
          this.agents.update(agents => [...agents, agent]);
          this.loaded.set(true);
          this.createSuccess.set(
            'Agent créé avec succès. Il reste désactivé et soumis à validation humaine.',
          );
          this.name = '';
          this.key = '';
          this.description = '';
          this.selectedCapabilities = [];
        },
        error: error => {
          if (error.status === 409) {
            this.createError.set('Cette clé est déjà utilisée.');
          } else if (error.status === 400) {
            this.createError.set('Les informations fournies sont invalides.');
          } else if (error.status === 401) {
            this.createError.set('Session expirée. Reconnecte-toi.');
          } else {
            this.createError.set("Impossible de créer l'agent.");
          }
        },
      });
  }

  readonly total = computed(() => this.agents().length);

  readonly enabled = computed(() =>
    this.agents().filter(agent => agent.enabled).length,
  );

  ngOnInit(): void {
    this.loadAgents();
  }

  loadAgents(): void {
    if (this.loading()) return;

    this.loading.set(true);
    this.error.set('');

    this.agentsService.getAgents()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: agents => {
          this.agents.set(agents);
          this.loaded.set(true);
        },
        error: () => {
          this.error.set(
            "Impossible de charger les agents. Vérifie la connexion à l'API.",
          );
        },
      });
  }

  typeLabel(type: AgentType): string {
    const labels: Record<AgentType, string> = {
      system: 'Système',
      employment: 'Emploi',
      portfolio: 'Portfolio',
    };

    return labels[type];
  }
}
