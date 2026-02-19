import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { TouchTooltipDirective } from '@/shared/directives/touch-tooltip.directive';

@Component({
    selector: 'app-category-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        DialogModule,
        ButtonModule,
        TooltipModule,
        InputTextModule,
        TextareaModule,
        MessageModule,
        CheckboxModule,
        InputNumberModule,
        TouchTooltipDirective
    ],
    template: `
    <p-dialog
        [(visible)]="visible"
        [style]="{ width: '32rem', maxWidth: '90vw' }"
        header="Detalle de Categoría"
        [modal]="true"
        styleClass="category-dialog"
        contentStyleClass="category-dialog-content"
        (onHide)="onHide()">
        <ng-template #content>
            <div class="category-form-container">
                <form [formGroup]="categoryForm" class="category-form">
                    <!-- Campo Nombre -->
                    <div class="form-field">
                        <div class="flex align-items-center gap-2 mb-2">
                            <label for="name" class="field-label">Nombre <span class="text-red-500">*</span></label>
                            <button
                                pButton
                                type="button"
                                icon="pi pi-info-circle"
                                class="p-button-sm p-button-text p-button-plain info-button"
                                pTooltip="Escribe un nombre claro y corto para la categoría (ej. Desayunos, Bebidas). Este nombre será visible para los clientes."
                                tooltipPosition="top"
                                appTouchTooltip>
                            </button>
                        </div>
                        <input
                            type="text"
                            pInputText
                            id="name"
                            formControlName="name"
                            required
                            autofocus
                            placeholder="Ej: Desayunos, Bebidas, Postres..."
                            class="w-full" />
                        <p-message
                            *ngIf="categoryForm.get('name')?.invalid && (categoryForm.get('name')?.touched || submitted)"
                            severity="error"
                            [text]="'El nombre es requerido'">
                        </p-message>
                    </div>

                    <!-- Campo Descripción -->
                    <div class="form-field">
                        <div class="flex align-items-center gap-2 mb-2">
                            <label for="description" class="field-label">Descripción <span class="text-red-500">*</span></label>
                            <button
                                pButton
                                type="button"
                                icon="pi pi-info-circle"
                                class="p-button-sm p-button-text p-button-plain info-button"
                                pTooltip="Describe brevemente la categoría y qué tipos de productos incluye. Ayuda a los clientes a entender lo que van a encontrar."
                                tooltipPosition="top"
                                appTouchTooltip>
                            </button>
                        </div>
                        <textarea
                            id="description"
                            pTextarea
                            formControlName="description"
                            rows="4"
                            placeholder="Describe qué tipos de productos incluye esta categoría..."
                            class="w-full">
                        </textarea>
                        <p-message
                            *ngIf="categoryForm.get('description')?.invalid && (categoryForm.get('description')?.touched || submitted)"
                            severity="error"
                            [text]="'La descripción es requerida'">
                        </p-message>
                    </div>

                    <!-- Campo Activo -->
                    <div class="form-field-checkbox">
                        <div class="flex align-items-center gap-3">
                            <p-checkbox
                                formControlName="active"
                                [binary]="true"
                                inputId="active">
                            </p-checkbox>
                            <label for="active" class="field-label-checkbox">Categoría activa</label>
                            <button
                                pButton
                                type="button"
                                icon="pi pi-info-circle"
                                class="p-button-sm p-button-text p-button-plain info-button"
                                pTooltip="Marca como activo para que la categoría esté disponible en el menú. Desactívala si no quieres mostrarla temporalmente."
                                tooltipPosition="top"
                                appTouchTooltip>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </ng-template>

        <ng-template #footer>
            <div class="category-dialog-footer">
                <p-button
                    label="Cancelar"
                    icon="pi pi-times"
                    severity="secondary"
                    [outlined]="true"
                    (onClick)="hide.emit()" />
                <p-button
                    label="Guardar"
                    icon="pi pi-check"
                    severity="success"
                    (onClick)="save.emit()" />
            </div>
        </ng-template>
    </p-dialog>
    `,
    styles: [`
        /* === DIÁLOGO === */
        ::ng-deep .category-dialog {
            .p-dialog-header {
                background: linear-gradient(135deg, var(--lealtix-primary-500, #6366f1) 0%, var(--lealtix-primary-600, #4f46e5) 100%);
                color: white;
                padding: 1.25rem 1.5rem;
                border-radius: 1rem 1rem 0 0;

                .p-dialog-title {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: white;
                }

                .p-dialog-header-icon {
                    color: white;

                    &:hover {
                        background-color: rgba(255, 255, 255, 0.1);
                    }
                }
            }
        }

        /* === CONTENIDO DEL DIÁLOGO === */
        .category-dialog-content {
            padding: 0 !important;
        }

        .category-form-container {
            padding: 1.5rem;
        }

        .category-form {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        /* === CAMPOS DEL FORMULARIO === */
        .form-field {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .field-label {
            font-weight: 600;
            font-size: 0.9375rem;
            color: var(--lealtix-slate-800, #1e293b);
            margin: 0;
        }

        .field-label-checkbox {
            font-weight: 500;
            font-size: 0.9375rem;
            color: var(--lealtix-slate-700, #334155);
            margin: 0;
            cursor: pointer;
        }

        .form-field-checkbox {
            padding: 1rem;
            background: var(--lealtix-slate-50, #f8fafc);
            border-radius: 0.75rem;
            border: 1px solid var(--lealtix-slate-200, #e2e8f0);
        }

        /* === BOTÓN DE INFORMACIÓN === */
        ::ng-deep .info-button {
            width: 2rem !important;
            height: 2rem !important;
            padding: 0 !important;
            color: var(--lealtix-primary-500, #6366f1) !important;

            &:hover {
                background-color: var(--lealtix-primary-50, #eef2ff) !important;
            }
        }

        /* === INPUTS === */
        ::ng-deep {
            .p-inputtext,
            .p-inputtextarea {
                border-radius: 0.75rem !important;
                border-color: var(--lealtix-slate-300, #cbd5e1) !important;
                transition: all 0.2s ease !important;
                font-size: 0.9375rem !important;

                &:focus {
                    border-color: var(--lealtix-primary-500, #6366f1) !important;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1) !important;
                }

                &::placeholder {
                    color: var(--lealtix-slate-400, #94a3b8) !important;
                }
            }
        }

        /* === MENSAJES DE ERROR === */
        ::ng-deep .p-message {
            margin-top: 0.5rem;
            border-radius: 0.5rem !important;
            font-size: 0.875rem !important;

            &.p-message-error {
                background-color: #fee2e2 !important;
                border-color: #991b1b !important;
                color: #991b1b !important;
            }
        }

        /* === FOOTER === */
        .category-dialog-footer {
            display: flex;
            justify-content: flex-end;
            gap: 0.75rem;
            padding: 1rem 1.5rem;
            border-top: 1px solid var(--lealtix-slate-200, #e2e8f0);
            background: var(--lealtix-slate-50, #f8fafc);
        }

        ::ng-deep .category-dialog-footer {
            .p-button {
                padding: 0.625rem 1.25rem !important;
                font-weight: 600 !important;
                border-radius: 0.75rem !important;
                transition: all 0.2s ease !important;

                &:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1) !important;
                }
            }
        }

        /* === CHECKBOX === */
        ::ng-deep .p-checkbox {
            .p-checkbox-box {
                border-radius: 0.375rem;
                border-color: var(--lealtix-slate-300, #cbd5e1);

                &.p-highlight {
                    background: var(--lealtix-primary-500, #6366f1);
                    border-color: var(--lealtix-primary-500, #6366f1);
                }
            }
        }
    `]
})
export class CategoryDialogComponent {
    @Input() visible: boolean = false;
    @Output() visibleChange = new EventEmitter<boolean>();

    @Input() category: any = {};
    @Input() categoryForm!: any;
    @Input() submitted: boolean = false;

    @Output() save = new EventEmitter<void>();
    @Output() hide = new EventEmitter<void>();

    onHide() {
        this.visibleChange.emit(false);
        this.hide.emit();
    }
}
