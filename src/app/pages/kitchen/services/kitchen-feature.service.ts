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
        const email = this.authService.getCurrentUser()?.email ?? this.getStoredEmail();
        if (!email) {
            return of(false);
        }

        return this.tenantService.getTenantByEmail(email).pipe(
            map((response) => {
                const tenant = response?.object ?? response?.data ?? response;
                return this.resolveKitchenFlag(tenant);
            }),
            catchError(() => of(false))
        );
    }

    private getStoredEmail(): string | null {
        try {
            const userStr = sessionStorage.getItem('usuario') ?? localStorage.getItem('usuario');
            if (!userStr) {
                return null;
            }
            const userObj = JSON.parse(userStr) as { userEmail?: string };
            return userObj.userEmail ?? null;
        } catch {
            return null;
        }
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
