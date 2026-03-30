import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../../auth/auth.service';

/**
 * WaiterGuard
 * Verifies user has 'dashboard_mesero' permission before allowing route access
 * Redirects to default dashboard if unauthorized
 */
export const WaiterGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasPermission('dashboard_mesero')) {
    return true;
  }

  // Unauthorized - redirect to default dashboard
  router.navigate(['/dashboard/kpis']);
  return false;
};
