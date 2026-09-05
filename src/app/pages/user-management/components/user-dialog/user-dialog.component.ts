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
    InputNumberModule
  ],
  styleUrls: ['./user-dialog.component.scss'],
  template: `
    <p-dialog
      [(visible)]="visible"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [style]="{ width: '36rem', maxWidth: '90vw' }"
      [contentStyle]="{ 'max-height': 'calc(90vh - 120px)', 'overflow': 'auto' }"
      [dismissableMask]="true"
      [maximizable]="true"
      [resizable]="true"
      styleClass="user-dialog"
      (onHide)="onHide()"
    >
      <ng-template #header>
        <div class="flex align-items-center gap-3">
          <i [class]="usuarioEnEdicion ? 'pi pi-pencil' : 'pi pi-user-plus'"></i>
          <div>
            <h2>{{ usuarioEnEdicion ? 'Editar Miembro' : 'Nuevo Miembro' }}</h2>
          </div>
        </div>
      </ng-template>

      <div class="user-form-container">
        <form [formGroup]="usuarioForm" class="p-fluid">
          <!-- Nombre Completo -->
          <div class="col-span-full">
            <label for="nombre">
              Nombre Completo <span class="text-red-500">*</span>
            </label>
            <input
              id="nombre"
              pInputText
              formControlName="nombre"
              placeholder="Ej: Juan Pérez"
            />
            <p-message
              *ngIf="usuarioForm.get('nombre')?.invalid && (usuarioForm.get('nombre')?.touched || submitted)"
              severity="error"
              text="Nombre es requerido"
            ></p-message>
          </div>

          <!-- Email -->
          <div class="col-span-full">
            <label for="email">
              Email <span class="text-red-500">*</span>
            </label>
            <input
              id="email"
              pInputText
              formControlName="email"
              type="email"
              placeholder="Ej: juan@example.com"
            />
            <p-message
              *ngIf="usuarioForm.get('email')?.invalid && (usuarioForm.get('email')?.touched || submitted)"
              severity="error"
              text="Email válido es requerido"
            ></p-message>
          </div>

          <!-- Contraseña (solo en creación) -->
          <div class="col-span-full" *ngIf="!usuarioEnEdicion">
            <label for="contrasena">
              Contraseña <span class="text-red-500">*</span>
            </label>
            <p-password
              id="contrasena"
              formControlName="contrasena"
              placeholder="••••••••"
              [feedback]="false"
              [toggleMask]="true"
            ></p-password>
            <p-message
              *ngIf="usuarioForm.get('contrasena')?.invalid && (usuarioForm.get('contrasena')?.touched || submitted)"
              severity="error"
              text="Contraseña es requerida (mínimo 6 caracteres)"
            ></p-message>
          </div>

          <!-- Contraseña (opcional en edición) -->
          <div class="col-span-full" *ngIf="usuarioEnEdicion">
            <label for="contrasena">
              Nueva Contraseña <span class="text-gray-500">(Opcional)</span>
            </label>
            <p-password
              id="contrasena"
              formControlName="contrasena"
              placeholder="Dejar vacío para mantener la actual"
              [feedback]="false"
              [toggleMask]="true"
            ></p-password>
          </div>

          <!-- Rol -->
          <div class="col-span-full">
            <label for="rol">
              Rol <span class="text-red-500">*</span>
            </label>
            <p-select
              id="rol"
              formControlName="rol"
              [options]="availableRoles"
              optionLabel="label"
              optionValue="value"
              placeholder="Seleccionar rol"
              appendTo="body"
            >
              <ng-template pTemplate="item" let-option>
                <span>{{ option.label }}</span>
              </ng-template>
              <ng-template pTemplate="selectedItem" let-option>
                <span *ngIf="option">{{ option.label }}</span>
              </ng-template>
            </p-select>
            <p-message
              *ngIf="usuarioForm.get('rol')?.invalid && (usuarioForm.get('rol')?.touched || submitted)"
              severity="error"
              text="Rol es requerido"
            ></p-message>
          </div>

          <!-- Sueldo Mensual -->
          <div class="col-span-full">
            <label for="sueldoMensual">
              Sueldo Mensual (USD)
              <span class="text-red-500">*</span>
            </label>
            <p-inputNumber
              id="sueldoMensual"
              formControlName="sueldoMensual"
              [min]="0"
              mode="currency"
              currency="USD"
              locale="en-US"
              placeholder="Ej: 100"
              styleClass="w-full"
            ></p-inputNumber>
            <p-message
              *ngIf="usuarioForm.get('sueldoMensual')?.invalid && (usuarioForm.get('sueldoMensual')?.touched || submitted)"
              severity="error"
              text="El sueldo mensual es requerido y no puede ser negativo"
            ></p-message>
          </div>

          <!-- Permisos (informativo) -->
          <div class="col-span-full" *ngIf="usuarioForm.get('rol')?.value">
            <label>Permisos asignados</label>
            <div class="flex flex-wrap gap-2">
              <p-tag
                *ngFor="let permission of getPermissionsForRole(usuarioForm.get('rol')?.value)"
                [value]="permission"
                severity="info"
              ></p-tag>
            </div>
          </div>
        </form>
      </div>

      <ng-template #footer>
        <div class="user-dialog-footer">
          <p-button
            label="Cancelar"
            icon="pi pi-times"
            text
            (click)="hide.emit()"
            [disabled]="loading"
          ></p-button>
          <p-button
            [label]="usuarioEnEdicion ? 'Actualizar' : 'Crear'"
            icon="pi pi-check"
            (click)="save.emit()"
            [disabled]="usuarioForm.invalid || loading"
            [loading]="loading"
          ></p-button>
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

  getPermissionsForRole(rol: UserRole): string[] {
    return ROLE_PERMISSIONS[rol] || [];
  }
}
