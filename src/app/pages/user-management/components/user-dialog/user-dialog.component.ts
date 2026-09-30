import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormGroup } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { InputNumberModule } from 'primeng/inputnumber';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { UserRole, ROLE_PERMISSIONS } from '@/models/user.model';

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    SelectModule,
    TagModule,
    MessageModule,
    InputNumberModule,
    IconFieldModule,
    InputIconModule
  ],
  styleUrls: ['./user-dialog.component.scss'],
  template: `
    <p-dialog
      [(visible)]="visible"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [style]="{ width: '38rem', maxWidth: '94vw' }"
      [contentStyle]="{ 'max-height': 'calc(90vh - 120px)', 'overflow': 'auto' }"
      [dismissableMask]="true"
      [maximizable]="false"
      [resizable]="false"
      styleClass="user-dialog-modal"
      (onHide)="onHide()"
    >
      <ng-template #header>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white text-lg shrink-0 shadow-xs">
            <i [class]="usuarioEnEdicion ? 'pi pi-user-edit' : 'pi pi-user-plus'"></i>
          </div>
          <div>
            <h3 class="text-base font-extrabold text-white m-0 leading-tight">
              {{ usuarioEnEdicion ? 'Editar Miembro del Equipo' : 'Nuevo Miembro / Mesero' }}
            </h3>
            <p class="text-xs text-white/80 m-0 mt-0.5 font-medium">
              {{ usuarioEnEdicion ? 'Actualiza los datos y asignaciones del usuario' : 'Ingresa la información para dar de alta al usuario en el sistema' }}
            </p>
          </div>
        </div>
      </ng-template>

      <div class="user-form-container">
        <form [formGroup]="usuarioForm" class="user-form-stack" (ngSubmit)="save.emit()">
          <!-- Nombre Completo -->
          <div class="form-field-group">
            <label for="nombre">
              <span>Nombre Completo</span>
              <span class="text-rose-500 font-bold">*</span>
            </label>
            <p-iconfield iconPosition="left" class="w-full">
              <p-inputicon styleClass="pi pi-user text-slate-400"></p-inputicon>
              <input
                id="nombre"
                pInputText
                formControlName="nombre"
                placeholder="Ej: Juan Pérez García"
                class="w-full"
                autocomplete="off"
              />
            </p-iconfield>
            <div
              *ngIf="usuarioForm.get('nombre')?.invalid && (usuarioForm.get('nombre')?.touched || submitted)"
              class="field-error-msg"
            >
              <i class="pi pi-exclamation-circle"></i>
              <span>El nombre completo es requerido (mínimo 2 caracteres)</span>
            </div>
          </div>

          <!-- Email -->
          <div class="form-field-group">
            <label for="email">
              <span>Correo Electrónico (Email)</span>
              <span class="text-rose-500 font-bold">*</span>
            </label>
            <p-iconfield iconPosition="left" class="w-full">
              <p-inputicon styleClass="pi pi-envelope text-slate-400"></p-inputicon>
              <input
                id="email"
                pInputText
                formControlName="email"
                type="email"
                placeholder="Ej: mesero@lealtix.com"
                class="w-full"
                autocomplete="off"
              />
            </p-iconfield>
            <div
              *ngIf="usuarioForm.get('email')?.invalid && (usuarioForm.get('email')?.touched || submitted)"
              class="field-error-msg"
            >
              <i class="pi pi-exclamation-circle"></i>
              <span>Ingresa un correo electrónico válido</span>
            </div>
          </div>

          <!-- Contraseña (solo en creación) -->
          <div class="form-field-group" *ngIf="!usuarioEnEdicion">
            <label for="contrasena">
              <span>Contraseña de Acceso</span>
              <span class="text-rose-500 font-bold">*</span>
            </label>
            <p-password
              id="contrasena"
              formControlName="contrasena"
              placeholder="Mínimo 6 caracteres"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            ></p-password>
            <div
              *ngIf="usuarioForm.get('contrasena')?.invalid && (usuarioForm.get('contrasena')?.touched || submitted)"
              class="field-error-msg"
            >
              <i class="pi pi-exclamation-circle"></i>
              <span>La contraseña es requerida (mínimo 6 caracteres)</span>
            </div>
          </div>

          <!-- Contraseña (opcional en edición) -->
          <div class="form-field-group" *ngIf="usuarioEnEdicion">
            <label for="contrasena">
              <span>Nueva Contraseña</span>
              <span class="text-slate-400 text-xs font-normal lowercase">(dejar vacío para conservar actual)</span>
            </label>
            <p-password
              id="contrasena"
              formControlName="contrasena"
              placeholder="••••••••"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
            ></p-password>
          </div>

          <!-- Fila de Rol y Sueldo Mensual -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Rol -->
            <div class="form-field-group">
              <label for="rol">
                <span>Rol / Puesto</span>
                <span class="text-rose-500 font-bold">*</span>
              </label>
              <p-select
                id="rol"
                formControlName="rol"
                [options]="availableRoles"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccionar rol"
                appendTo="body"
                class="w-full"
                styleClass="w-full"
              >
                <ng-template pTemplate="item" let-option>
                  <div class="flex items-center gap-2 py-1">
                    <i class="pi pi-id-card text-purple-600 text-xs"></i>
                    <span class="font-medium text-slate-700">{{ option.label }}</span>
                  </div>
                </ng-template>
                <ng-template pTemplate="selectedItem" let-option>
                  <div class="flex items-center gap-2" *ngIf="option">
                    <i class="pi pi-id-card text-purple-600 text-xs"></i>
                    <span class="font-semibold text-slate-800">{{ option.label }}</span>
                  </div>
                </ng-template>
              </p-select>
              <div
                *ngIf="usuarioForm.get('rol')?.invalid && (usuarioForm.get('rol')?.touched || submitted)"
                class="field-error-msg"
              >
                <i class="pi pi-exclamation-circle"></i>
                <span>Selecciona un rol</span>
              </div>
            </div>

            <!-- Sueldo Mensual -->
            <div class="form-field-group">
              <label for="sueldoMensual">
                <span>Sueldo Mensual (USD)</span>
                <span class="text-rose-500 font-bold">*</span>
              </label>
              <p-inputNumber
                id="sueldoMensual"
                formControlName="sueldoMensual"
                [min]="0"
                mode="currency"
                currency="USD"
                locale="en-US"
                placeholder="$100.00"
                class="w-full"
                styleClass="w-full"
                inputStyleClass="w-full"
              ></p-inputNumber>
              <div
                *ngIf="usuarioForm.get('sueldoMensual')?.invalid && (usuarioForm.get('sueldoMensual')?.touched || submitted)"
                class="field-error-msg"
              >
                <i class="pi pi-exclamation-circle"></i>
                <span>Sueldo requerido y no negativo</span>
              </div>
            </div>
          </div>

          <!-- Permisos Informativos -->
          <div class="permisos-card" *ngIf="usuarioForm.get('rol')?.value">
            <div class="permisos-card-title">
              <i class="pi pi-shield"></i>
              <span>Permisos del puesto: {{ getRolLabel(usuarioForm.get('rol')?.value) }}</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <span
                *ngFor="let permission of getPermissionsForRole(usuarioForm.get('rol')?.value)"
                class="permiso-tag"
              >
                {{ permission }}
              </span>
            </div>
          </div>
        </form>
      </div>

      <ng-template #footer>
        <div class="user-dialog-footer">
          <button
            type="button"
            class="btn-dialog-cancel"
            (click)="hide.emit()"
            [disabled]="loading"
          >
            <i class="pi pi-times mr-1.5"></i>
            <span>Cancelar</span>
          </button>
          <button
            type="button"
            class="btn-dialog-submit"
            (click)="save.emit()"
            [disabled]="usuarioForm.invalid || loading"
          >
            <i class="pi mr-1.5" [class]="loading ? 'pi-spin pi-spinner' : 'pi-check'"></i>
            <span>{{ usuarioEnEdicion ? 'Actualizar Miembro' : 'Crear Miembro' }}</span>
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `
})
export class UserDialogComponent {
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() usuarioEnEdicion: any = null;
  @Input() usuarioForm!: FormGroup;
  @Input() submitted: boolean = false;
  @Input() loading: boolean = false;
  @Input() availableRoles: any[] = [];

  @Output() save = new EventEmitter<void>();
  @Output() hide = new EventEmitter<void>();

  readonly ROLE_PERMISSIONS = ROLE_PERMISSIONS;

  onVisibleChange(visible: boolean) {
    this.visibleChange.emit(visible);
  }

  onHide() {
    this.visibleChange.emit(false);
    this.hide.emit();
  }

  getPermissionsForRole(rol: any): string[] {
    if (!rol) return [];
    return ROLE_PERMISSIONS[rol as UserRole] || [];
  }

  getRolLabel(rolValue: any): string {
    if (!rolValue) return '';
    const found = this.availableRoles?.find(r => r.value === rolValue || r === rolValue);
    return found ? (found.label || found.value || found) : rolValue;
  }
}
