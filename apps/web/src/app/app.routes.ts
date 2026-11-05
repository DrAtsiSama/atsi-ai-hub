import { AgentManagement } from './features/agent-management/agent-management';
import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';
import { Login } from './features/login/login';
import { Dashboard } from './features/dashboard/dashboard';

import { ExecutionDetail } from './features/execution-detail/execution-detail';

export const routes: Routes = [
  {
    path: '',
    component: Login,
  },
  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [adminGuard],
  },
  {
    path: 'dashboard/agents',
    component: AgentManagement,
    canActivate: [adminGuard],
  },
  {
    path: 'dashboard/executions/:id',
    component: ExecutionDetail,
    canActivate: [adminGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
