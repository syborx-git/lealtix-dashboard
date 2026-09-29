import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuListComponent } from '../component/menu-list/menu-list.component';
import { LayoutService } from '../service/layout.service';
import { MenuService } from '../service/menu.service';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [CommonModule, RouterModule, MenuListComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './sidebar.component.html',
    styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
    readonly layoutService = inject(LayoutService);

    private readonly menuService = inject(MenuService);

    /** `true` = barra reducida a iconos. Fuente única de verdad: el LayoutService. */
    readonly collapsed = computed(() => this.layoutService.isSidebarCollapsed());

    constructor() {
        this.menuService.init();
    }

    onToggle(): void {
        this.layoutService.toggleSidebar();
    }
}
