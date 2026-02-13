import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormGroup } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-cliente-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    DatePickerModule,
    SelectModule,
    MessageModule
  ],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '600px' }"
      [contentStyle]="{ 'max-height': 'calc(90vh - 120px)', 'overflow': 'auto' }"
      [dismissableMask]="true"
      [maximizable]="true"
      [resizable]="true"
      styleClass="cliente-dialog"
      (onHide)="onHide()"
    >
      <ng-template #header>
        <div class="flex align-items-center gap-3">
          <i [class]="clienteEnEdicion ? 'pi pi-pencil text-2xl text-primary' : 'pi pi-user-plus text-2xl text-primary'"></i>
          <div>
            <h2 class="m-0 text-xl font-semibold">{{ clienteEnEdicion ? 'Editar Cliente' : 'Nuevo Cliente' }}</h2>
          </div>
        </div>
      </ng-template>

      <div class="p-5">
        <form [formGroup]="clienteForm" class="p-fluid">
          <div class="grid grid-cols-2 gap-4">
            <!-- Nombre Completo -->
            <div class="col-span-full">
              <label for="nombreCompleto" class="block text-sm font-medium mb-2">
                Nombre Completo <span class="text-red-500">*</span>
              </label>
              <input
                id="nombreCompleto"
                pInputText
                formControlName="nombreCompleto"
                placeholder="Ej: Juan Pérez García"
              />
              <p-message
                *ngIf="clienteForm.get('nombreCompleto')?.invalid && (clienteForm.get('nombreCompleto')?.touched || submitted)"
                severity="error"
                variant="text"
                size="small"
                text="Nombre es requerido"
              ></p-message>
            </div>

            <!-- Email -->
            <div>
              <label for="email" class="block text-sm font-medium mb-2">
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
                *ngIf="clienteForm.get('email')?.invalid && (clienteForm.get('email')?.touched || submitted)"
                severity="error"
                variant="text"
                size="small"
                text="Email válido es requerido"
              ></p-message>
            </div>

            <!-- Teléfono (Opcional) -->
            <div>
              <label for="telefono" class="block text-sm font-medium mb-2">
                Teléfono <span class="text-gray-500">(Opcional)</span>
              </label>
              <input
                id="telefono"
                pInputText
                formControlName="telefono"
                placeholder="Ej: 5512345678"
                maxlength="10"
                inputmode="numeric"
                (input)="onTelefonoInput($event)"
              />
              <p-message
                *ngIf="clienteForm.get('telefono')?.invalid && (clienteForm.get('telefono')?.touched || submitted)"
                severity="error"
                variant="text"
                size="small"
                text="Teléfono debe contener 10 dígitos numéricos"
              ></p-message>
            </div>

            <!-- Fecha de Nacimiento -->
            <div>
              <label for="fechaNacimiento" class="block text-sm font-medium mb-2">
                Fecha de Nacimiento <span class="text-red-500">*</span>
              </label>
              <p-datepicker
                id="fechaNacimiento"
                formControlName="fechaNacimiento"
                placeholder="Selecciona fecha"
                [showIcon]="true"
                dateFormat="dd/mm/yy"
                class="w-full"
                appendTo="body"
                yearNavigator="true"
                yearRange="1900:2030"
              ></p-datepicker>
              <p-message
                *ngIf="clienteForm.get('fechaNacimiento')?.invalid && (clienteForm.get('fechaNacimiento')?.touched || submitted)"
                severity="error"
                variant="text"
                size="small"
                [text]="getFechaError()"
              ></p-message>
            </div>

            <!-- Género -->
            <div>
              <label for="genero" class="block text-sm font-medium mb-2">
                Género <span class="text-red-500">*</span>
              </label>
              <p-select
                formControlName="genero"
                [options]="generoOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccionar género"
                appendTo="body"
              ></p-select>
              <p-message
                *ngIf="clienteForm.get('genero')?.invalid && (clienteForm.get('genero')?.touched || submitted)"
                severity="error"
                variant="text"
                size="small"
                text="Género es requerido"
              ></p-message>
            </div>
          </div>
        </form>
      </div>

      <ng-template #footer>
        <div class="flex justify-end gap-3 p-3">
          <p-button
            label="Cancelar"
            icon="pi pi-times"
            text
            (click)="hide.emit()"
          ></p-button>
          <p-button
            [label]="clienteEnEdicion ? 'Actualizar' : 'Crear'"
            icon="pi pi-check"
            (click)="save.emit()"
            [disabled]="clienteForm.invalid"
          ></p-button>
        </div>
      </ng-template>
    </p-dialog>
  `
  ,
  styles: [`
    :host ::ng-deep .cliente-dialog .p-dialog-content { padding: 0 !important; }
    .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 1rem; }
  `]
})
export class ClienteDialogComponent {
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() clienteEnEdicion: any = null;
  @Input() clienteForm!: FormGroup;
  @Input() submitted: boolean = false;
  @Input() generoOptions: any[] = [];

  @Output() save = new EventEmitter<void>();
  @Output() hide = new EventEmitter<void>();

  onHide() {
    this.visibleChange.emit(false);
    this.hide.emit();
  }

  onTelefonoInput(event: any) {
    if (!this.clienteForm) return;
    const raw = event.target.value || '';
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    this.clienteForm.get('telefono')?.setValue(digits);
  }

  getFechaError(): string {
    const ctrl = this.clienteForm?.get('fechaNacimiento');
    if (!ctrl) return '';
    if (ctrl.hasError('required')) return 'Fecha de nacimiento es requerida';
    if (ctrl.hasError('invalidDate')) return 'Fecha inválida';
    if (ctrl.hasError('tooYoung')) {
      const info = ctrl.getError('tooYoung');
      return `La edad debe ser mayor a ${info.requiredAge} años`;
    }
    return '';
  }
}
