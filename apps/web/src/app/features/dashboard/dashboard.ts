import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { AgentsService } from '../../core/agents/agents.service';
import { AgentExecution } from '../../core/agents/agents.models';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly agents = inject(AgentsService);
  private readonly router = inject(Router);

  readonly loggingOut = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly historyError = signal('');
  readonly historyLoaded = signal(false);
  readonly executions = signal<AgentExecution[]>([]);

  readonly total = computed(() => this.executions().length);

  readonly completed = computed(() =>
    this.executions().filter(
      execution => execution.status === 'completed',
    ).length,
  );

  readonly failed = computed(() =>
    this.executions().filter(
      execution => execution.status === 'failed',
    ).length,
  );

  readonly active = computed(() =>
    this.executions().filter(
      execution =>
        execution.status === 'queued' ||
        execution.status === 'active' ||
        execution.status === 'running' ||
        execution.status === 'waiting',
    ).length,
  );

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

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    if (this.loading()) return;

    this.loading.set(true);
    this.historyError.set('');

    this.agents.getHistory()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: response => {
          this.executions.set(response.executions);
          this.historyLoaded.set(true);
        },
        error: () => {
          this.historyError.set(
            "Impossible de récupérer les données. Les statistiques affichées peuvent être anciennes.",
          );
        },
      });
  }

  logout(): void {
    if (this.loggingOut()) return;

    this.loggingOut.set(true);
    this.error.set('');

    this.auth.logout()
      .pipe(finalize(() => this.loggingOut.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigateByUrl('/');
        },
        error: () => {
          this.error.set(
            'Déconnexion impossible. Veuillez réessayer.',
          );
        },
      });
  }
}
