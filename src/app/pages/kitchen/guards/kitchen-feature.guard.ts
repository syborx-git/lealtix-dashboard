import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of, catchError } from 'rxjs';
import { KitchenFeatureService } from '../services/kitchen-feature.service';

export const KitchenFeatureGuard: CanActivateFn = () => {
    const router = inject(Router);
    const kitchenFeatureService = inject(KitchenFeatureService);

    return kitchenFeatureService.isKitchenEnabledForCurrentTenant$().pipe(
        map((enabled) => {
            if (enabled) {
                return true;
            }

            return router.createUrlTree(['/dashboard/kpis']);
        }),
        catchError(() => of(router.createUrlTree(['/dashboard/kpis'])))
    );
};
