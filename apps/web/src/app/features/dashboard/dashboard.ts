import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, catchError, EMPTY, finalize, interval, startWith, switchMap, take, takeUntil, timer } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { AgentsService } from '../../core/agents/agents.service';
import { AgentExecution } from '../../core/agents/agents.models';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly agents = inject(AgentsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly stopTracking$ = new Subject<void>();

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

  readonly instruction = signal('');
  readonly confirmingRun = signal(false);
  readonly submittingRun = signal(false);
  readonly runMessage = signal('');
  readonly runError = signal('');
  readonly trackedJobId = signal("");
  readonly trackedJobStatus = signal("");
  readonly trackingError = signal("");
  readonly trackingActive = signal(false);


  prepareRun(): void {
    this.runMessage.set('');
    this.runError.set('');

    const value = this.instruction().trim();

    if (!value || value.length > 2000) {
      this.runError.set(
        'Saisis une instruction de 1 à 2 000 caractères.',
      );
      return;
    }

    this.confirmingRun.set(true);
  }

  cancelRun(): void {
    this.confirmingRun.set(false);
  }

  confirmRun(): void {
    if (this.submittingRun()) {
      return;
    }

    const value = this.instruction().trim();

    if (!value || value.length > 2000) {
      this.confirmingRun.set(false);
      this.runError.set('Instruction invalide.');
      return;
    }

    this.confirmingRun.set(false);
    this.submittingRun.set(true);
    this.runError.set('');
    this.runMessage.set('');

    this.agents.runDemo(value)
      .pipe(finalize(() => this.submittingRun.set(false)))
      .subscribe({
        next: response => {
          this.runMessage.set(
            `Exécution envoyée : ${response.runId}`,
          );
          this.instruction.set('');
          this.loadHistory();
          this.stopTracking$.next();
          this.trackJob(response.jobId);
        },
        error: () => {
          this.runError.set(
            "Impossible de déclencher l'agent. Vérifie la connexion et réessaie.",
          );
        },
      });
  }

  trackJob(jobId: string): void {
    this.trackedJobId.set(jobId);
    this.trackedJobStatus.set('queued');
    this.trackingError.set('');
    this.trackingActive.set(true);

    timer(0, 2000)
      .pipe(
        take(60),
        takeUntilDestroyed(this.destroyRef),
        takeUntil(this.stopTracking$),
        switchMap(() =>
          this.agents.getJob(jobId).pipe(
            catchError(() => {
              this.trackingError.set(
                "Impossible de récupérer le statut de l'agent.",
              );
              this.trackingActive.set(false);
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe({
        next: job => {
          this.trackedJobStatus.set(job.status);

          if (job.status === 'completed' || job.status === 'failed') {
            this.trackingActive.set(false);
            this.stopTracking$.next();
            this.loadHistory();
          }
        },
        complete: () => {
          if (this.trackingActive()) {
            this.trackingActive.set(false);
            this.trackingError.set(
              'Suivi arrêté après 2 minutes. Actualise pour consulter le résultat.',
            );
          }
        },
      });
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
