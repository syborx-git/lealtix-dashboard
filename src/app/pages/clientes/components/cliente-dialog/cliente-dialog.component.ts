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
  styleUrls: ['./cliente-dialog.component.scss'],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '36rem', maxWidth: '90vw' }"
      [contentStyle]="{ 'max-height': 'calc(90vh - 120px)', 'overflow': 'auto' }"
      [dismissableMask]="true"
      [maximizable]="true"
      [resizable]="true"
      styleClass="cliente-dialog"
      (onHide)="onHide()"
    >
      <ng-template #header>
        <div class="flex align-items-center gap-3">
          <i [class]="clienteEnEdicion ? 'pi pi-pencil' : 'pi pi-user-plus'"></i>
          <div>
            <h2>{{ clienteEnEdicion ? 'Editar Cliente' : 'Nuevo Cliente' }}</h2>
          </div>
        </div>
      </ng-template>

      <div class="cliente-form-container">
        <form [formGroup]="clienteForm" class="p-fluid">
          <div class="grid grid-cols-2">
            <!-- Nombre Completo -->
            <div class="col-span-full">
              <label for="nombreCompleto">
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
                [text]="'Nombre es requerido'"
              ></p-message>
            </div>

            <!-- Email -->
            <div>
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
                *ngIf="clienteForm.get('email')?.invalid && (clienteForm.get('email')?.touched || submitted)"
                severity="error"
                [text]="'Email válido es requerido'"
              ></p-message>
            </div>

            <!-- Teléfono (Opcional) -->
            <div>
              <label for="telefono">
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
                [text]="'Teléfono debe contener 10 dígitos numéricos'"
              ></p-message>
            </div>

            <!-- Fecha de Nacimiento -->
            <div>
              <label for="fechaNacimiento">
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
                [text]="getFechaError()"
              ></p-message>
            </div>

            <!-- Género -->
            <div>
              <label for="genero">
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
                [text]="'Género es requerido'"
              ></p-message>
            </div>
          </div>
        </form>
      </div>

      <ng-template #footer>
        <div class="cliente-dialog-footer">
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
