import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Table, TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ReservaService } from '../services/reserva.service';
import { MesaService } from '../services/mesa.service';
import { AuthService } from '@/auth/auth.service';
import { ReservaDTO, ReservaEstado, RESERVA_ESTADO_COLORS } from '../models/reserva.model';
import { EstadoTagSeverity } from '../models/mesa.model';

interface EstadoOption {
    label: string;
    value: ReservaEstado;
}

@Component({
    selector: 'app-reservaciones',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ToolbarModule,
        ButtonModule,
        DialogModule,
        TableModule,
        InputTextModule,
        InputNumberModule,
        TextareaModule,
        SelectModule,
        DatePickerModule,
        TagModule,
        TooltipModule,
        ProgressSpinnerModule,
        ToastModule,
        ConfirmDialogModule
    ],
    providers: [MessageService, ConfirmationService],
    templateUrl: './reservaciones.component.html',
    styleUrls: ['./reservaciones.component.scss']
})
export class ReservacionesComponent implements OnInit {
    @ViewChild('dt') dt!: Table;

    reservas = signal<ReservaDTO[]>([]);
    mesas = signal<{ id: number; nombre: string }[]>([]);
    loading = signal(false);
    tenantId = 0;

    estadoFiltro: ReservaEstado | '' = '';

    readonly estadoOptions: EstadoOption[] = [
        { label: 'Pendiente', value: 'PENDIENTE' },
        { label: 'Confirmada', value: 'CONFIRMADA' },
        { label: 'Cancelada', value: 'CANCELADA' },
        { label: 'Cumplida', value: 'CUMPLIDA' }
    ];

    reservaDialogVisible = false;
    editingReserva: ReservaDTO | null = null;
    saving = false;
    formCliente = '';
    formTelefono = '';
    formFecha: Date | null = null;
    formPersonas: number = 2;
    formMesaId: number | null = null;
    formNotas = '';

    constructor(
        private reservaService: ReservaService,
        private mesaService: MesaService,
        private authService: AuthService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        const user = this.authService.getCurrentUser();
        this.tenantId = user?.tenantId || 0;
        if (this.tenantId) {
            this.loadReservas();
            this.loadMesas();
        } else {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo determinar el tenant del usuario' });
        }
    }

    loadReservas() {
        this.loading.set(true);
        this.reservaService.getReservas(this.tenantId).subscribe({
            next: (res) => {
                this.reservas.set((res || []).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)));
                this.loading.set(false);
            },
            error: () => {
                this.reservas.set([]);
                this.loading.set(false);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las reservaciones' });
            }
        });
    }

    loadMesas() {
        this.mesaService.getMesas(this.tenantId).subscribe({
            next: (res) => this.mesas.set((res || []).map(m => ({ id: m.id as number, nombre: m.nombre }))),
            error: () => this.mesas.set([])
        });
    }

    filteredReservas(): ReservaDTO[] {
        const all = this.reservas();
        if (!this.estadoFiltro) {
            return all;
        }
        return all.filter(r => r.estado === this.estadoFiltro);
    }

    onGlobalFilter(event: Event) {
        this.dt?.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }

    getEstadoSeverity(estado: ReservaEstado): EstadoTagSeverity {
        return RESERVA_ESTADO_COLORS[estado] || 'secondary';
    }

    private parseFecha(d: Date): string {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    private parseFechaTime(fechaIso: string): Date | null {
        if (!fechaIso) return null;
        const d = new Date(fechaIso);
        return isNaN(d.getTime()) ? null : d;
    }

    openNewReserva() {
        this.editingReserva = null;
        this.formCliente = '';
        this.formTelefono = '';
        this.formFecha = null;
        this.formPersonas = 2;
        this.formMesaId = null;
        this.formNotas = '';
        this.reservaDialogVisible = true;
    }

    openEditReserva(reserva: ReservaDTO) {
        this.editingReserva = reserva;
        this.formCliente = reserva.clienteNombre;
        this.formTelefono = reserva.telefono || '';
        this.formFecha = this.parseFechaTime(reserva.fecha);
        this.formPersonas = reserva.numeroPersonas;
        this.formMesaId = reserva.mesaId ?? null;
        this.formNotas = reserva.notas || '';
        this.reservaDialogVisible = true;
    }

    saveReserva() {
        if (!this.formCliente?.trim() || !this.formFecha || !this.formPersonas || this.formPersonas <= 0) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Cliente, fecha y número de personas son obligatorios' });
            return;
        }

        this.saving = true;
        const payload = {
            clienteNombre: this.formCliente.trim(),
            telefono: this.formTelefono?.trim() || undefined,
            fecha: this.parseFecha(this.formFecha),
            numeroPersonas: this.formPersonas,
            mesaId: this.formMesaId ?? undefined,
            notas: this.formNotas?.trim() || undefined
        };

        const request = this.editingReserva
            ? this.reservaService.updateReserva(this.editingReserva.id as number, this.tenantId, payload)
            : this.reservaService.createReserva(this.tenantId, payload);

        request.subscribe({
            next: (res) => {
                this.saving = false;
                this.reservaDialogVisible = false;
                this.messageService.add({
                    severity: 'success',
                    summary: 'Exitoso',
                    detail: this.editingReserva ? 'Reservación actualizada' : 'Reservación creada'
                });
                this.loadReservas();
            },
            error: (err) => {
                this.saving = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo guardar la reservación' });
            }
        });
    }

    onCancelReserva(reserva: ReservaDTO) {
        if (reserva.estado === 'CANCELADA' || reserva.estado === 'CUMPLIDA') {
            this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: 'La reservación ya no puede cancelarse' });
            return;
        }
        this.confirmationService.confirm({
            message: `¿Deseas cancelar la reservación de ${reserva.clienteNombre}?`,
            header: 'Confirmar cancelación',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sí, cancelar',
            rejectLabel: 'Volver',
            accept: () => {
                this.reservaService.cancelReserva(reserva.id as number, this.tenantId).subscribe({
                    next: () => {
                        this.loadReservas();
                        this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: 'Reservación cancelada' });
                    },
                    error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo cancelar' })
                });
            }
        });
    }

    onDeleteReserva(reserva: ReservaDTO) {
        this.confirmationService.confirm({
            message: `¿Estás seguro de que deseas eliminar la reservación de ${reserva.clienteNombre}?`,
            header: 'Confirmar eliminación',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sí, eliminar',
            rejectLabel: 'Cancelar',
            accept: () => {
                this.reservaService.deleteReserva(reserva.id as number, this.tenantId).subscribe({
                    next: () => {
                        this.reservas.set(this.reservas().filter(r => r.id !== reserva.id));
                        this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: 'Reservación eliminada' });
                    },
                    error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo eliminar' })
                });
            }
        });
    }
}