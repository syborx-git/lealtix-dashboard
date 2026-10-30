import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PwaUpdateService } from './app/pwa-update.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule],
    template: `<router-outlet></router-outlet>`
})
export class AppComponent {
    // Inyectar para activar la auto-actualización de la PWA en producción.
    private readonly pwaUpdate = inject(PwaUpdateService);
}
