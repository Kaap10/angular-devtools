import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home').then((m) => m.Home) },
  { path: 'about', loadComponent: () => import('./pages/about').then((m) => m.About) },
];
