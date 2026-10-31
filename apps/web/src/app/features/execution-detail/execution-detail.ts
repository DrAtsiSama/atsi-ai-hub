import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AgentsService } from '../../core/agents/agents.service';
import { AgentExecution } from '../../core/agents/agents.models';

@Component({
  selector: 'app-execution-detail',
  imports: [DatePipe, JsonPipe, RouterLink],
  templateUrl: './execution-detail.html',
  styleUrl: './execution-detail.scss',
})
export class ExecutionDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly agents = inject(AgentsService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly execution = signal<AgentExecution | null>(null);

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      queued: 'En attente',
      waiting: 'En attente',
      active: 'En cours',
      running: 'En cours',
      completed: 'Terminée',
      failed: 'Échec',
    };

    return labels[status] ?? status;
  }

  duration(startedAt: string | null, completedAt: string | null): string {
    if (!startedAt || !completedAt) {
      return 'Non disponible';
    }

    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return 'Non disponible';
    }

    const milliseconds = end - start;

    if (milliseconds < 1000) {
      return `${milliseconds} ms`;
    }

    const seconds = milliseconds / 1000;

    if (seconds < 60) {
      return `${seconds.toFixed(2)} s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${minutes} min ${remainingSeconds} s`;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.error.set('Identifiant manquant.');
      this.loading.set(false);
      return;
    }

    this.agents.getExecution(id).subscribe({
      next: execution => {
        this.execution.set(execution);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          "Impossible de récupérer les détails de cette exécution.",
        );
        this.loading.set(false);
      },
    });
  }
}
