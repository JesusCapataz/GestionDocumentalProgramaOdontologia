import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingService } from '../../../../services/loading.service';

export type AccountTab = 'perfil' | 'seguridad';

export interface PerfilPayload   { nombres: string; apellidos: string; }
export interface PasswordPayload { actual: string;  nueva: string;    }

@Component({
  selector: 'app-account-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account-modal.html',
  styleUrls:   ['./account-modal.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountModalComponent {

  private cdr            = inject(ChangeDetectorRef);
  readonly loadingService = inject(LoadingService);

  // ── Inputs ──────────────────────────────────────────────
  @Input() isOpen    = false;
  @Input() nombres   = '';
  @Input() apellidos = '';
  @Input() correo    = '';
  @Input() rol       = '';      // Rol bonito para mostrar: "Super Admin"
  @Input() rolReal   = '';      // Rol real del backend: "SUPER_ADMIN"

  // ── Outputs ─────────────────────────────────────────────
  @Output() closeModal         = new EventEmitter<void>();
  @Output() actualizarPerfil   = new EventEmitter<PerfilPayload>();
  @Output() actualizarPassword = new EventEmitter<PasswordPayload>();
  @Output() verificarIdentidad = new EventEmitter<string>(); // ← nuevo

  // ── Estado interno de edición ───────────────────────────
  editNombres   = '';
  editApellidos = '';

  // ── Pestaña activa ──────────────────────────────────────
  activeTab: AccountTab = 'perfil';

  // ── Seguridad ───────────────────────────────────────────
  passwordActual        = '';
  passwordNueva         = '';
  passwordConfirma      = '';
  showActual            = false;
  showNueva             = false;
  showConfirma          = false;
  identidadConfirmada   = false;  // ← controla si mostrar paso 2
  verificandoIdentidad  = false;  // ← spinner mientras llama al backend
  errorIdentidad        = '';
  estadoBoton: 'idle' | 'success' | 'error' = 'idle';
  campoActivo = false;
  // Fuerza al navegador a no autocompletar este campo específico
  readonly antiAutofill = 'campo-verify-' + Date.now();

  // ── Errores de validación ───────────────────────────────
  errorNombres   = false;
  errorApellidos = false;

  // ── Lifecycle ───────────────────────────────────────────
  ngOnChanges(): void {
    if (this.isOpen) {
      this.editNombres   = this.nombres;
      this.editApellidos = this.apellidos;
      this.resetSecurity();
      this.clearErrors();
    }
  }

  // ── Navegación de pestañas ──────────────────────────────
  setTab(tab: AccountTab): void {
    this.activeTab = tab;
    this.clearErrors();
  }

  // ── Backdrop ────────────────────────────────────────────
  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('am-backdrop')) {
      this.close();
    }
  }

  close(): void {
    this.resetSecurity();
    this.clearErrors();
    this.activeTab = 'perfil';
    this.closeModal.emit();
  }

  // ── Guardar perfil ──────────────────────────────────────
  savePerfil(): void {
    this.errorNombres   = !this.editNombres.trim();
    this.errorApellidos = !this.editApellidos.trim();

    if (this.errorNombres || this.errorApellidos) {
      this.cdr.markForCheck();
      return;
    }

    // Title Case ya aplicado aquí — el Dashboard no necesita reformatear
    const payload: PerfilPayload = {
      nombres:   this.toTitleCase(this.editNombres),
      apellidos: this.toTitleCase(this.editApellidos)
    };

    // Emitimos el payload limpio y nos cerramos; el Dashboard actualiza el estado central
    this.actualizarPerfil.emit(payload);
    this.close();
  }

  // ── Guardar contraseña ──────────────────────────────────
  // PASO 1: Verificar identidad antes de mostrar los campos de nueva contraseña
  confirmarIdentidad(): void {
    if (!this.passwordActual.trim()) return;
    this.verificandoIdentidad = true;
    this.estadoBoton = 'idle';
    this.errorIdentidad = '';
    this.cdr.detectChanges();
    setTimeout(() => {
      this.verificarIdentidad.emit(this.passwordActual);
    }, 150);
  }

  // El Dashboard llama a este método con el resultado de la verificación
  respuestaIdentidad(esCorrecta: boolean): void {
    this.verificandoIdentidad = false;

    if (esCorrecta) {
      this.estadoBoton = 'success';
      this.errorIdentidad = '';
      this.cdr.detectChanges();
      setTimeout(() => {
        this.identidadConfirmada = true;
        this.estadoBoton = 'idle';
        this.cdr.detectChanges();
      }, 1000);
    } else {
      this.estadoBoton = 'error';
      // Mensaje visible bajo el input — el HTML ya escucha estadoBoton === 'error'
      this.errorIdentidad = 'Contraseña incorrecta. Intenta de nuevo.';
      this.cdr.detectChanges();
    }
  }

  // PASO 2: Guardar la nueva contraseña (solo llega aquí si identidad confirmada)
  saveSeguridad(): void {
    if (this.passwordsNoCoinciden
        || !this.passwordNueva) return;

    this.actualizarPassword.emit({
      actual: this.passwordActual,
      nueva:  this.passwordNueva
    });

    this.close();
  }

  // ── Validación reactiva al perder foco ──────────────────
  onNombresBlur(): void {
    if (this.errorNombres) {
      this.errorNombres = !this.editNombres.trim();
    }
  }

  onApellidosBlur(): void {
    if (this.errorApellidos) {
      this.errorApellidos = !this.editApellidos.trim();
    }
  }

  // ── Getters ─────────────────────────────────────────────
  get passwordsNoCoinciden(): boolean {
    return this.passwordConfirma.length > 0
      && this.passwordNueva !== this.passwordConfirma;
  }

  get avatarInitials(): string {
    const n = (this.editNombres   || this.nombres  ).trim();
    const a = (this.editApellidos || this.apellidos).trim();
    return [(n[0] ?? ''), (a[0] ?? '')].join('').toUpperCase();
  }

  get displayName(): string {
    const n = (this.editNombres   || this.nombres  ).trim();
    const a = (this.editApellidos || this.apellidos).trim();
    return `${n} ${a}`.trim();
  }

  // ── Utilidad: Title Case compatible con español ─────────
  //
  // El enfoque split + map evita \b\w, cuyo comportamiento
  // es indefinido ante vocales acentuadas (á, é, í, ó, ú)
  // y la eñe (ñ), que en algunos motores JS son tratadas
  // como límites de palabra, produciendo resultados como
  // "JesúS" o "MañaNa".
  //
  // Aquí cada palabra se parte manualmente:
  //   - índice 0  → toUpperCase()  (funciona con cualquier
  //                                 carácter Unicode)
  //   - slice(1)  → toLowerCase()  (resto de la palabra)
  //
  // Palabras vacías (espacios dobles) se filtran con filter
  // y se re-unen con un solo espacio.
  //
  private toTitleCase(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => word[0].toUpperCase() + word.slice(1))
      .join(' ');
  }

  // ── Limpieza interna ────────────────────────────────────
  private resetSecurity(): void {
    this.passwordActual       = '';
    this.passwordNueva        = '';
    this.passwordConfirma     = '';
    this.showActual           = false;
    this.showNueva            = false;
    this.showConfirma         = false;
    this.identidadConfirmada  = false;
    this.verificandoIdentidad = false;
    this.errorIdentidad       = '';
    this.estadoBoton          = 'idle';
    this.campoActivo          = false;
  }

  private clearErrors(): void {
    this.errorNombres   = false;
    this.errorApellidos = false;
  }
}