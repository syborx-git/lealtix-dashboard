import { Injectable } from '@angular/core';
import { Observable, map, of, catchError } from 'rxjs';
import { AuthService } from '@/auth/auth.service';
import { TenantService } from '@/pages/admin-page/service/tenant.service';

@Injectable({
    providedIn: 'root'
})
export class KitchenFeatureService {
    constructor(
        private authService: AuthService,
        private tenantService: TenantService
    ) {}

    isKitchenEnabledForCurrentTenant$(): Observable<boolean> {
        const tenantId = this.authService.getCurrentUser()?.tenantId;
        if (!tenantId) {
            return of(false);
        }

        return this.tenantService.getTenantById(tenantId).pipe(
            map((tenant) => {
                return this.resolveKitchenFlag(tenant);
            }),
            catchError(() => of(false))
        );
    }

    private resolveKitchenFlag(tenant: any): boolean {
        if (!tenant) {
            return false;
        }

        const candidate =
            tenant.has_kitchen_module ??
            tenant.hasKitchenModule ??
            tenant.kitchenEnabled ??
            tenant.kitchenModuleEnabled;

        if (typeof candidate === 'boolean') {
            return candidate;
        }

        if (typeof candidate === 'number') {
            return candidate === 1;
        }

        if (typeof candidate === 'string') {
            const normalized = candidate.trim().toLowerCase();
            return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'si';
        }

        return false;
    }
}
