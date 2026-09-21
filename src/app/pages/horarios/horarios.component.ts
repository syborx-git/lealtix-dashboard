import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '@/auth/auth.service';
import { UserService } from '@/pages/user-management/services/user.service';

interface Jornada {
  id: number;
  titulo: string;
  horaInicio: string;
  horaFin: string;
  color: string;
}

interface Asignacion {
  id: number;
  empleadoId: number;
  empleadoNombre: string;
  dia: number;
  jornadaId: number;
}

const DIAS_SEMANA = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' }
];

const PALETA = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

@Component({
  selector: 'app-horarios',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    DatePickerModule,
    ToastModule,
    ConfirmDialogModule,
    ProgressSpinnerModule,
    TooltipModule
  ],
  templateUrl: './horarios.component.html',
  styleUrls: ['./horarios.component.scss'],
  providers: [MessageService, ConfirmationService]
})
export class HorariosComponent implements OnInit {
  tenantId = 1;

  dias = DIAS_SEMANA;

  jornadas = signal<Jornada[]>([]);
  asignaciones = signal<Asignacion[]>([]);
  empleados = signal<{ id: number; nombre: string }[]>([]);
  empleadosLoading = signal<boolean>(false);

  // Modal crear jornada
  jornadaVisible = false;
  jornadaSaving = signal<boolean>(false);
  jornadaTitulo = '';
  jornadaInicio: Date | null = null;
  jornadaFin: Date | null = null;

  // Modal asignar turno
  asignarVisible = false;
  asignarSaving = signal<boolean>(false);
  asignarEmpleadoId: number | null = null;
  asignarDia: number | null = null;
  asignarJornadaId: number | null = null;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.tenantId = user?.tenantId ?? 1;
    this.cargarDeStorage();
    this.cargarEmpleados();
  }

  /* ============ Persistencia local ============ */

  private storageKey(): string {
    return `lealtix_horarios_${this.tenantId}`;
  }

  private cargarDeStorage(): void {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (raw) {
        const data = JSON.parse(raw);
        this.jornadas.set(data?.jornadas ?? []);
        this.asignaciones.set(data?.asignaciones ?? []);
      }
    } catch (e) {
      console.warn('Error cargando horarios:', e);
    }
  }

  private guardarEnStorage(): void {
    try {
      const data = { jornadas: this.jornadas(), asignaciones: this.asignaciones() };
      localStorage.setItem(this.storageKey(), JSON.stringify(data));
    } catch (e) {
      console.warn('Error guardando horarios:', e);
    }
  }

  /* ============ Empleados ============ */

  cargarEmpleados(): void {
    this.empleadosLoading.set(true);
    this.userService.getUsuarios(this.tenantId).subscribe({
      next: (res) => {
        const usuarios = (res?.usuarios ?? []) as any[];
        this.empleados.set(
          usuarios
            .filter((u) => u.activo !== false)
            .map((u) => ({ id: u.id, nombre: u.nombre ?? u.nombre_usuario ?? u.email }))
        );
        this.empleadosLoading.set(false);
      },
      error: () => {
        this.empleados.set([]);
        this.empleadosLoading.set(false);
      }
    });
  }

  /* ============ Utilerías de hora ============ */

  private formatHora(date: Date | null): string | null {
    if (!date) return null;
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  private aMinutos(hora: string): number {
    const [hh, mm] = hora.split(':').map(Number);
    return hh * 60 + mm;
  }

  /* ============ Jornadas ============ */

  private siguienteColor(): string {
    return PALETA[this.jornadas().length % PALETA.length];
  }

  abrirCrearJornada(): void {
    this.jornadaTitulo = '';
    this.jornadaInicio = null;
    this.jornadaFin = null;
    this.jornadaSaving.set(false);
    this.jornadaVisible = true;
  }

  crearJornada(): void {
    const titulo = this.jornadaTitulo.trim();
    const inicio = this.formatHora(this.jornadaInicio);
    const fin = this.formatHora(this.jornadaFin);

    if (!titulo) {
      this.messageService.add({ severity: 'warn', summary: 'Título requerido', detail: 'Escribe un nombre para identificar la jornada.' });
      return;
    }
    if (!inicio || !fin) {
      this.messageService.add({ severity: 'warn', summary: 'Horas requeridas', detail: 'Define la hora de inicio y la hora de finalización.' });
      return;
    }
    if (inicio === fin) {
      this.messageService.add({ severity: 'warn', summary: 'Horas inválidas', detail: 'La hora de inicio y fin no pueden ser iguales.' });
      return;
    }

    if (this.aMinutos(fin) <= this.aMinutos(inicio)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Jornada nocturna',
        detail: `Se registrará como jornada que cruza la medianoche (${inicio} – ${fin}).`
      });
    }

    const nueva: Jornada = {
      id: Date.now(),
      titulo,
      horaInicio: inicio,
      horaFin: fin,
      color: this.siguienteColor()
    };

    this.jornadas.update((prev) => [...prev, nueva]);
    this.guardarEnStorage();
    this.jornadaVisible = false;
    this.messageService.add({ severity: 'success', summary: 'Jornada creada', detail: `${titulo} (${inicio} – ${fin})` });
  }

  borrarJornada(jornada: Jornada): void {
    this.confirmationService.confirm({
      message: `¿Eliminar la jornada "${jornada.titulo}" y sus asignaciones?`,
      header: 'Eliminar jornada',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.jornadas.update((prev) => prev.filter((j) => j.id !== jornada.id));
        this.asignaciones.update((prev) => prev.filter((a) => a.jornadaId !== jornada.id));
        this.guardarEnStorage();
        this.messageService.add({ severity: 'success', summary: 'Jornada eliminada', detail: jornada.titulo });
      }
    });
  }

  /* ============ Asignaciones ============ */

  abrirAsignarTurno(): void {
    this.asignarEmpleadoId = null;
    this.asignarDia = null;
    this.asignarJornadaId = null;
    this.asignarSaving.set(false);
    this.asignarVisible = true;
  }

  asignarTurno(): void {
    if (this.asignarEmpleadoId == null || this.asignarDia == null || this.asignarJornadaId == null) {
      this.messageService.add({ severity: 'warn', summary: 'Datos incompletos', detail: 'Selecciona empleado, día y jornada.' });
      return;
    }

    const existe = this.asignaciones().some(
      (a) => a.empleadoId === this.asignarEmpleadoId && a.dia === this.asignarDia && a.jornadaId === this.asignarJornadaId
    );
    if (existe) {
      this.messageService.add({ severity: 'warn', summary: 'Turno duplicado', detail: 'Este empleado ya tiene asignado ese turno ese día.' });
      return;
    }

    const empleado = this.empleados().find((e) => e.id === this.asignarEmpleadoId);
    const diaLabel = this.dias.find((d) => d.value === this.asignarDia)?.label ?? '';
    const jornada = this.jornadas().find((j) => j.id === this.asignarJornadaId);

    const nueva: Asignacion = {
      id: Date.now(),
      empleadoId: this.asignarEmpleadoId,
      empleadoNombre: empleado?.nombre ?? 'Empleado',
      dia: this.asignarDia,
      jornadaId: this.asignarJornadaId
    };

    this.asignaciones.update((prev) => [...prev, nueva]);
    this.guardarEnStorage();
    this.asignarVisible = false;
    this.messageService.add({
      severity: 'success',
      summary: 'Turno asignado',
      detail: `${nueva.empleadoNombre} → ${diaLabel}, ${jornada?.titulo} (${jornada?.horaInicio} – ${jornada?.horaFin})`
    });
  }

  quitarAsignacion(asignacion: Asignacion): void {
    this.asignaciones.update((prev) => prev.filter((a) => a.id !== asignacion.id));
    this.guardarEnStorage();
  }

  /* ============ Helpers de template ============ */

  asignacionesPorDia(dia: number): Asignacion[] {
    return this.asignaciones().filter((a) => a.dia === dia);
  }

  jornadaDe(asignacion: Asignacion): Jornada | null {
    return this.jornadas().find((j) => j.id === asignacion.jornadaId) ?? null;
  }

  nombreDia(dia: number): string {
    return this.dias.find((d) => d.value === dia)?.label ?? '';
  }

  resumenAsignacion(): string {
    if (this.asignarEmpleadoId == null || this.asignarDia == null || this.asignarJornadaId == null) return '';
    const empleado = this.empleados().find((e) => e.id === this.asignarEmpleadoId);
    const diaLabel = this.nombreDia(this.asignarDia);
    const jornada = this.jornadas().find((j) => j.id === this.asignarJornadaId);
    return `${empleado?.nombre ?? '—'} • ${diaLabel} • ${jornada?.titulo ?? '—'} (${jornada?.horaInicio} – ${jornada?.horaFin})`;
  }
}