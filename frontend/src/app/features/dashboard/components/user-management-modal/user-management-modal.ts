import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef,
  OnChanges, inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuarioService, UsuarioResumen, AppRole } from '../../../../services/usuario.service';

export interface RolChangeEvent {
  usuarioId: number;
  nuevoRol: AppRole;
}

export const ROLES_ASIGNABLES: { value: AppRole; label: string }[] = [
  { value: 'ESTUDIANTE', label: 'Estudiante' },
  { value: 'DOCENTE', label: 'Docente' },
  { value: 'ADMINISTRADOR', label: 'Administrador' }
];

const AVATAR_COLORS = [
  '#0066CC', '#0891b2', '#059669',
  '#7c3aed', '#db2777', '#d97706'
];

interface UsuarioFila extends UsuarioResumen {
  iniciales: string;
  color: string;
  cargandoRol: boolean;
}

function toFila(u: UsuarioResumen, index: number): UsuarioFila {
  return {
    ...u,
    iniciales: `${u.nombre[0] ?? ''}${u.apellido[0] ?? ''}`.toUpperCase(),
    color: AVATAR_COLORS[index % AVATAR_COLORS.length],
    cargandoRol: false
  };
}

@Component({
  selector: 'app-user-management-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management-modal.html',
  styleUrls: ['./user-management-modal.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserManagementModalComponent {
      private readonly usuarioSvc = inject(UsuarioService);
  private readonly cdr = inject(ChangeDetectorRef);

  private _isOpen = false;
  
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
    this.cdr.markForCheck(); // 👈 El despertador oficial de Angular para OnPush
    
    if (value) {
      this.cargarUsuarios();
    } else {
      // Limpiamos todo al cerrar
      this.usuarios.set([]);
      this.searchQuery.set('');
      this.errorLista = '';
    }
  }
  
  get isOpen() { 
    return this._isOpen; 
  }
  @Input() currentUserEmail = '';
  @Input() currentUserRol = '';
  @Output() closeModal = new EventEmitter<void>();
  @Output() rolCambiado = new EventEmitter<RolChangeEvent>();

  readonly rolesAsignables = ROLES_ASIGNABLES;
  readonly searchQuery = signal('');
  cargandoLista = false;
  errorLista = '';
  private readonly usuarios = signal<UsuarioFila[]>([]);

  readonly usuariosFiltrados = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const lista = this.usuarios(); // Leemos la señal
    if (!q) return lista;
    return lista.filter(u =>
      `${u.nombre} ${u.apellido}`.toLowerCase().includes(q)
      || u.correo.toLowerCase().includes(q)
    );
  });

  

  cargarUsuarios(): void {
    this.cargandoLista = true;
    this.errorLista = '';
    this.usuarios.set([]);
    this.cdr.markForCheck();

    this.usuarioSvc.obtenerTodos().subscribe({
      next: (lista) => {
        this.usuarios.set(lista.map((u, i) => toFila(u, i)));
        this.cargandoLista = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error al cargar usuarios:', err);
        this.errorLista = 'No se pudo cargar la lista de usuarios.';
        this.cargandoLista = false;
        this.cdr.markForCheck();
      }
    });
  }

  onRolChange(usuario: UsuarioFila, nuevoRol: string): void {
    const rolAnterior = usuario.rol;
    usuario.rol = nuevoRol as AppRole;
    usuario.cargandoRol = true;
    this.cdr.markForCheck();

    this.usuarioSvc.cambiarRol(usuario.id, nuevoRol as AppRole).subscribe({
      next: () => {
        usuario.cargandoRol = false;
        this.rolCambiado.emit({ usuarioId: usuario.id, nuevoRol: usuario.rol });
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error al cambiar rol:', err);
        usuario.rol = rolAnterior;
        usuario.cargandoRol = false;
        this.cdr.markForCheck();
      }
    });
  }

  esSuperAdmin(u: UsuarioFila): boolean { return u.rol === 'SUPER_ADMIN'; }
  esUsuarioActual(u: UsuarioFila): boolean { return u.correo === this.currentUserEmail; }
  selectorBloqueado(u: UsuarioFila): boolean { return this.esSuperAdmin(u) || this.esUsuarioActual(u) || u.cargandoRol; }

  tooltipBloqueo(u: UsuarioFila): string {
    if (u.cargandoRol) return 'Guardando cambio…';
    if (this.esSuperAdmin(u)) return 'El rol Super Admin no puede modificarse';
    if (this.esUsuarioActual(u)) return 'No puedes cambiar tu propio rol';
    return '';
  }

  rolLabel(rol: AppRole): string {
    const map: Record<AppRole, string> = {
      SUPER_ADMIN: 'Super Admin',
      ADMINISTRADOR: 'Administrador',
      DOCENTE: 'Docente',
      ESTUDIANTE: 'Estudiante'
    };
    return map[rol] ?? rol;
  }

  onBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('um-backdrop')) {
      this.close();
    }
  }

  close(): void {
    this.searchQuery.set('');
    this.errorLista = '';
    this.closeModal.emit();
  }
}