import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';
import { Login } from './features/login/login';
import { Dashboard } from './features/dashboard/dashboard';

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
    path: '**',
    redirectTo: '',
  },
];
