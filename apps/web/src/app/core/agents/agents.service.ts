import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AgentExecution,
  AgentHistoryResponse,
  AgentJobResponse,
} from './agents.models';

@Injectable({
  providedIn: 'root',
})
export class AgentsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/agents';

  getHistory(): Observable<AgentHistoryResponse> {
    return this.http.get<AgentHistoryResponse>(
      `${this.apiUrl}/history`,
      { withCredentials: true },
    );
  }

  getExecution(id: string): Observable<AgentExecution> {
    return this.http.get<AgentExecution>(
      `${this.apiUrl}/history/${encodeURIComponent(id)}`,
      { withCredentials: true },
    );
  }

  getJob(id: string): Observable<AgentJobResponse> {
    return this.http.get<AgentJobResponse>(
      `${this.apiUrl}/jobs/${encodeURIComponent(id)}`,
      { withCredentials: true },
    );
  }
}
