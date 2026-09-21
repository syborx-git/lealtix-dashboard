import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { MesaService } from '../services/mesa.service';
import { UserService } from '@/pages/user-management/services/user.service';
import { AuthService } from '@/auth/auth.service';
import { MesaDTO, MesaEstado, EstadoTagSeverity, MESA_ESTADO_COLORS } from '../models/mesa.model';

interface EstadoOption {
    label: string;
    value: MesaEstado;
}

@Component({
    selector: 'app-mapeo-mesas',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ToolbarModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        InputNumberModule,
        SelectModule,
        TagModule,
        TooltipModule,
        ToastModule,
        ProgressSpinnerModule,
        ConfirmDialogModule
    ],
    providers: [MessageService, ConfirmationService],
    templateUrl: './mapeo-mesas.component.html',
    styleUrls: ['./mapeo-mesas.component.scss']
})
export class MapeoMesasComponent implements OnInit {
    mesas = signal<MesaDTO[]>([]);
    meseros = signal<{ id: number; nombre: string; email?: string }[]>([]);
    loading = signal(false);
    tenantId = 0;

    readonly estadoOptions: EstadoOption[] = [
        { label: 'Libre', value: 'LIBRE' },
        { label: 'Ocupada', value: 'OCUPADA' },
        { label: 'Reservada', value: 'RESERVADA' }
    ];

    mesaDialogVisible = false;
    editingMesa: MesaDTO | null = null;
    saving = false;
    formNombre = '';
    formNumero: number | null = null;
    formCapacidad: number = 2;
    formEstado: MesaEstado = 'LIBRE';

    constructor(
        private mesaService: MesaService,
        private userService: UserService,
        private authService: AuthService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        const user = this.authService.getCurrentUser();
        this.tenantId = user?.tenantId || 0;
        if (this.tenantId) {
            this.loadMesas();
            this.loadMeseros();
        } else {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo determinar el tenant del usuario' });
        }
    }

    loadMesas() {
        this.loading.set(true);
        this.mesaService.getMesas(this.tenantId).subscribe({
            next: (res) => {
                this.mesas.set(res || []);
                this.loading.set(false);
            },
            error: () => {
                this.mesas.set([]);
                this.loading.set(false);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las mesas' });
            }
        });
    }

    loadMeseros() {
        this.userService.getUsuarios(this.tenantId, { page: 0, pageSize: 100 }).subscribe({
            next: (res) => {
                const usuarios = res?.usuarios || [];
                const meseros = usuarios
                    .filter(u => (u.rol === 'MESERO'))
                    .map(u => ({ id: u.id as number, nombre: u.nombre, email: u.email }));
                this.meseros.set(meseros);
            },
            error: () => this.meseros.set([])
        });
    }

    getEstadoSeverity(estado: MesaEstado): EstadoTagSeverity {
        return MESA_ESTADO_COLORS[estado] || 'secondary';
    }

    openNewMesa() {
        this.editingMesa = null;
        this.formNombre = '';
        this.formNumero = null;
        this.formCapacidad = 2;
        this.formEstado = 'LIBRE';
        this.mesaDialogVisible = true;
    }

    openEditMesa(mesa: MesaDTO) {
        this.editingMesa = mesa;
        this.formNombre = mesa.nombre;
        this.formNumero = mesa.numero ?? null;
        this.formCapacidad = mesa.capacidad;
        this.formEstado = mesa.estado;
        this.mesaDialogVisible = true;
    }

    saveMesa() {
        if (!this.formNombre?.trim() || !this.formCapacidad || this.formCapacidad <= 0) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Nombre y capacidad son obligatorios' });
            return;
        }

        this.saving = true;
        const payload = {
            nombre: this.formNombre.trim(),
            numero: this.formNumero ?? undefined,
            capacidad: this.formCapacidad,
            estado: this.formEstado
        };

        const request = this.editingMesa
            ? this.mesaService.updateMesa(this.editingMesa.id as number, this.tenantId, payload)
            : this.mesaService.createMesa(this.tenantId, payload);

        request.subscribe({
            next: (res) => {
                this.saving = false;
                this.mesaDialogVisible = false;
                this.messageService.add({
                    severity: 'success',
                    summary: 'Exitoso',
                    detail: this.editingMesa ? 'Mesa actualizada' : 'Mesa creada'
                });
                this.loadMesas();
            },
            error: (err) => {
                this.saving = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo guardar la mesa' });
            }
        });
    }

    onAssignMesero(mesa: MesaDTO, meseroId: number | null) {
        const request = typeof meseroId === 'number' && meseroId > 0 ? { meseroUserId: meseroId } : { meseroUserId: null };
        this.mesaService.assignMesero(mesa.id as number, this.tenantId, request).subscribe({
            next: (res) => {
                const updated = this.mesas().map(m => (m.id === res.id ? res : m));
                this.mesas.set(updated);
                this.messageService.add({
                    severity: 'success',
                    summary: 'Exitoso',
                    detail: meseroId ? `Mesero asignado a ${res.nombre}` : `Mesero retirado de ${res.nombre}`
                });
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo asignar el mesero' })
        });
    }

    cycleEstado(mesa: MesaDTO) {
        const order: MesaEstado[] = ['LIBRE', 'OCUPADA', 'RESERVADA'];
        const idx = order.indexOf(mesa.estado);
        const next = order[(idx + 1) % order.length];
        this.mesaService.changeEstado(mesa.id as number, this.tenantId, next).subscribe({
            next: (res) => {
                const updated = this.mesas().map(m => (m.id === res.id ? res : m));
                this.mesas.set(updated);
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo cambiar el estado' })
        });
    }

    onDeleteMesa(mesa: MesaDTO) {
        this.confirmationService.confirm({
            message: `¿Estás seguro de que deseas eliminar la mesa "${mesa.nombre}"?`,
            header: 'Confirmar eliminación',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sí, eliminar',
            rejectLabel: 'Cancelar',
            accept: () => {
                this.mesaService.deleteMesa(mesa.id as number, this.tenantId).subscribe({
                    next: () => {
                        this.mesas.set(this.mesas().filter(m => m.id !== mesa.id));
                        this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: 'Mesa eliminada' });
                    },
                    error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo eliminar la mesa' })
                });
            }
        });
    }
}