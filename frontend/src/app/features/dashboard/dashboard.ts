import { Component, OnInit, OnDestroy, ChangeDetectorRef, signal, ViewChild, effect } from '@angular/core';
import { Subscription } from 'rxjs';
import { CanComponentDeactivate } from '../../guards/auth-navigation.guard';
import { Subject, Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { AnexoService } from '../../services/anexo';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
// --- HIJOS ---
import { MetricsCardsComponent } from './components/metrics-cards/metrics-cards';
import { AnexosTableComponent } from './components/anexos-table/anexos-table';
import { UploadModalComponent } from './components/upload-modal/upload-modal';
import { EditModalComponent } from './components/edit-modal/edit-modal';
import { PdfViewerModalComponent } from './components/pdf-viewer-modal/pdf-viewer-modal';
import { AiChatModalComponent } from './components/ai-chat-modal/ai-chat-modal';
import { NotificationService } from '../../notifications/notification.service';
import { KeyboardShortcutService } from '../../services/keyboard-shortcut.service';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';
import { LoadingService } from '../../services/loading.service';
import { AccountModalComponent } from './components/account-modal/account-modal';
import { UserManagementModalComponent } from './components/user-management-modal/user-management-modal';
import { ShortNamePipe } from '../../shared/pipes/short-name.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MetricsCardsComponent, AnexosTableComponent,
    UploadModalComponent, EditModalComponent, PdfViewerModalComponent,
    AiChatModalComponent, AccountModalComponent, ClickOutsideDirective,
    UserManagementModalComponent, ShortNamePipe
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  private _sub = new Subscription();
  // --- VARIABLES DE LÓGICA ---
  anexos: any[] = [];          // Los datos crudos del servidor
  anexosFiltrados: any[] = []; // Lo que la tabla va a mostrar
  listaAniosReales: string[] = [];
  
  filtroTexto = '';
  filtroCatPrin = '';
  filtroCatSec = '';
  filtroAnio = '';
  pausarClickOutside = false;
  @ViewChild('accountModal') accountModalRef?: AccountModalComponent;
  @ViewChild(AnexosTableComponent) tablaAnexos!: AnexosTableComponent;



  // --- VARIABLES DE MÉTRICAS ---
  totalAnexosMetrica = 0;
  actualizadosMetrica = 0;
  rangoAniosMetrica = '---';
  filtroActualizadosActivo = false;
  readonly isGlobalLoading: import('@angular/core').Signal<boolean>;

  readonly modalActivo = signal<string | null>(null);
  anexoSeleccionado: any = {};
  modalConfirmarSalida = false;
  modalErrorAbierto = false;
  modalAtajosAbierto = false;
  menuAbierto = false;

constructor(
  private anexoService: AnexoService, 
  private cdr: ChangeDetectorRef,
  private router: Router,
  private authService: AuthService,
  private notifService: NotificationService,
  private shortcutService: KeyboardShortcutService,
  private loadingService: LoadingService
) {
  this.isGlobalLoading = this.loadingService.isLoading;
  this.shortcutService.shortcutsHelp$.subscribe(() => {
    this.modalAtajosAbierto = true;
    this.cdr.detectChanges();
  });
}
  // ── Exponer la señal del servicio directamente al template ─
  get usuarioActivo() { return this.authService.usuarioActivo; }

  // ── Getters derivados de la señal (SRP: solo para la UI) ───
  get nombreUsuario():    string { return `${this.authService.primerNombre()} ${this.authService.primerApellido()}`.trim(); }
  get nombresUsuario():   string { return this.authService.usuarioActivo()?.nombres   ?? ''; }
  get apellidosUsuario(): string { return this.authService.usuarioActivo()?.apellidos ?? ''; }
  get rolUsuario():       string { return this.authService.usuarioActivo()?.rolBonito ?? ''; }
  get rolRealUsuario():   string { return this.authService.usuarioActivo()?.rol       ?? ''; }
  get correoUsuario():    string { return this.authService.usuarioActivo()?.correo    ?? ''; }
  get iniciales():        string {
    const n = this.authService.primerNombre();
    const a = this.authService.primerApellido();
    return (n[0] ?? '') + (a[0] ?? '');
  }

  ngOnInit() {
    window.addEventListener('ia-preview', (e: any) => {
      const anexo = this.anexos.find(a => a.id === e.detail.id);
      if (anexo) this.abrirModal('preview', anexo);
    });
    window.addEventListener('ia-descargar', (e: any) => {
      const anexo = this.anexos.find(a => a.id === e.detail.id);
      if (anexo) this.descargarAnexo(anexo);
    });

    // El estado del usuario ya fue rehidratado por AuthService en su constructor.
    // El Dashboard solo carga los datos de su competencia.
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this._sub.unsubscribe();
  }

  // 📂 Carga inicial desde Spring Boot
// 📂 Carga inicial desde Spring Boot
  cargarDatos() {
    this.anexoService.getAnexos().subscribe({
      next: (data: any) => {
        // 1. Guardamos los datos inmediatamente
        this.anexos = data;

        // 2. 🛡️ El escudo: Ejecutamos el resto un "tick" después para evitar errores de Angular
        setTimeout(() => {
          this.ejecutarFiltros(); 
          
          const aniosUnicos = [...new Set(data.map((a: any) => a.anio))].filter(a => a);
          this.listaAniosReales = (aniosUnicos as string[]).sort((a, b) => b.localeCompare(a));
          
          // Le avisamos a Angular que ya terminamos de procesar todo
          this.cdr.detectChanges();
        }, 0);
      },
      error: (err: any) => {
        console.error('Error cargando anexos:', err);
      }
    });
  }

  /**
   * 🌉 EL PUENTE: Este método recibe la señal de la Tabla.
   * Cuando escribes "reglamento" en la tabla, ella dispara este evento.
   */
  ejecutarFiltrosDesdeTabla(filtros: any) {
    this.filtroTexto = filtros.texto;
    this.filtroCatPrin = filtros.cat1;
    this.filtroCatSec = filtros.cat2;
    this.filtroAnio = filtros.anio;
    
    this.ejecutarFiltros(); // Llamamos a la lógica de filtrado real
  }

  ejecutarFiltros() {
    const busqueda = this.filtroTexto.toLowerCase().trim();

    // Filtramos sin restricción de fecha — el botón "Actualizados" solo ordena, no filtra
    this.anexosFiltrados = this.anexos.filter(a => {
      const coincideTexto = !busqueda || 
        a.nombre?.toLowerCase().includes(busqueda) || 
        a.descripcion?.toLowerCase().includes(busqueda);
      const coincideCat1 = !this.filtroCatPrin || 
        (a.categoriaPrincipal || '').toLowerCase() === this.filtroCatPrin.toLowerCase();
      const coincideCat2 = !this.filtroCatSec || 
        (a.categoriaSecundaria || '').toLowerCase() === this.filtroCatSec.toLowerCase();
      const coincideAnio = !this.filtroAnio || String(a.anio) === this.filtroAnio;

      return coincideTexto && coincideCat1 && coincideCat2 && coincideAnio;
    });

    // Sorting global: si está activo ordena por fecha desc (más reciente primero)
    // Si está inactivo ordena por ID asc (orden de inserción)
    if (this.filtroActualizadosActivo) {
      this.anexosFiltrados.sort((a, b) => {
        const fechaA = new Date(a.fechaActualizacion || a.fechaSubida || 0).getTime();
        const fechaB = new Date(b.fechaActualizacion || b.fechaSubida || 0).getTime();
        return fechaB - fechaA;
      });
    } else {
      this.anexosFiltrados.sort((a, b) => a.id - b.id);
    }

    this.calcularMetricasEnTiempoReal();
    this.cdr.detectChanges();
  }

  limpiarFiltros() {
    this.filtroTexto = ''; 
    this.filtroCatPrin = ''; 
    this.filtroCatSec = ''; 
    this.filtroAnio = '';
    this.ejecutarFiltros();
  }

  // 🪟 Gestión de Modales
// 🪟 Gestión de Modales
abrirModal(tipo: string, data: any) {
    this.modalActivo.set(tipo); // Usamos .set()
    this.anexoSeleccionado = { ...data, blobUrl: null, errorPdf: false };

  // SI ES EL VISOR PDF, TRAEMOS EL ARCHIVO CON EL TOKEN DE SEGURIDAD
  if (tipo === 'preview') {
    this.anexoService.verArchivoFisico(this.anexoSeleccionado.id).subscribe({
      next: (blob: Blob) => {
        // Solo asignamos blobUrl si es PDF — los demás no tienen previsualización
        const esPdf = blob.type === 'application/pdf' || blob.type.includes('pdf');
        if (esPdf) {
          this.anexoSeleccionado.blobUrl = window.URL.createObjectURL(blob);
        } else {
          // Excel, Word, PPT, TXT — no tienen vista previa en navegador
          // Guardamos el blob para descarga correcta con su extensión real
          this.anexoSeleccionado.blobUrl = null;
          this.anexoSeleccionado.blobDescarga = blob;
          this.anexoSeleccionado.esArchivoNoPrevisualizableConArchivo = true;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("No se pudo cargar el PDF o no existe", err);
        
        // 2. MODIFICACIÓN AQUÍ: 
        // No cerramos el modal. Simplemente decimos que hubo error en el PDF.
        this.anexoSeleccionado.blobUrl = null;
        this.anexoSeleccionado.errorPdf = true; // 👈 Activa el rayo rojo de Claude en el HTML
        
        // Despertamos a Angular para que pinte el error
        this.cdr.detectChanges(); 
      }
    });
  }
}

cerrarModal() { 
    this.modalActivo.set(null); // Usamos .set()
    this.anexoSeleccionado = {};
  }
  
 guardarNuevoAnexo(paquete: any) {
    // --- TRUCO DEL MONOLITO: Formatear datos para que Spring Boot no explote ---
    const datosParaGuardar: any = {
      nombre: paquete.datos.nombre,
      categoriaPrincipal: paquete.datos.categoriaPrincipal ? paquete.datos.categoriaPrincipal.toUpperCase() : '',
      categoriaSecundaria: paquete.datos.categoriaSecundaria ? paquete.datos.categoriaSecundaria.toUpperCase() : '',
      descripcion: paquete.datos.descripcion || '',
      numeroAnexo: paquete.datos.numeroAnexo || null,
      tipoDocumento: paquete.datos.tipoDocumento || null,
      fuente: paquete.datos.fuente || null
    };

    // UX: Aseguramos que el año sea un Número entero real o Null estricto
    if (paquete.datos.anio && String(paquete.datos.anio).trim() !== '') {
      datosParaGuardar.anio = parseInt(paquete.datos.anio, 10);
    } else {
      datosParaGuardar.anio = null;
    }

    // 1. Mandamos los datos formateados a Spring Boot
    this.anexoService.guardarAnexo(datosParaGuardar).subscribe({
      next: (res: any) => {
        const idReal = res.id;
        
        // 2. Si hay archivo, lo subimos amarrado a ese ID
        if (paquete.archivo) {
          this.anexoService.subirArchivoFisico(idReal, paquete.archivo).subscribe({
            next: () => {
              this.cargarDatos(); // Refrescamos la tabla
              this.cerrarModal(); // Cerramos la ventana
              this.notifService.showSuccess('Anexo subido correctamente'); // 👈 ¡NUEVO!
            },
            error: (err) => {
              console.error("Error subiendo PDF al servidor:", err);
              this.cargarDatos();
              this.cerrarModal();
              this.notifService.showWarning('Anexo guardado, pero falló la subida del archivo. Intenta editarlo y sube el PDF de nuevo.');
            }
          });
        } else {
          this.cargarDatos();
          this.cerrarModal();
          this.notifService.showSuccess('Anexo guardado (sin archivo adjunto)'); // 👈 ¡NUEVO!
        }
      },
      error: (err) => {
        // Imprimimos el error real en la consola (F12) para saber qué no le gustó a Spring Boot
        console.error("Error devuelto por la Base de Datos:", err);
        alert('Error: El servidor rechazó los datos. Presiona F12 para ver el detalle en la consola.');
      }
    });
  }

actualizarAnexoExistente(paquete: any) {
    const anexoEditado = paquete.datos;
    const archivoNuevo = paquete.archivo;
    const eliminarArchivo: boolean = paquete.eliminarArchivo === true;
    const id = anexoEditado.id;
    
    // 2. 🧹 FORMATEO: Preparamos solo lo que Spring Boot entiende
    const datosParaGuardar: any = {
      id: id,
      nombre: anexoEditado.nombre,
      categoriaPrincipal: anexoEditado.categoriaPrincipal,
      categoriaSecundaria: anexoEditado.categoriaSecundaria,
      descripcion: anexoEditado.descripcion,
      tieneArchivo: anexoEditado.tieneArchivo,
      numeroAnexo: anexoEditado.numeroAnexo || null,
      tipoDocumento: anexoEditado.tipoDocumento || null,
      fuente: anexoEditado.fuente || null
    };

    if (anexoEditado.anio && String(anexoEditado.anio).trim() !== '') {
      datosParaGuardar.anio = parseInt(anexoEditado.anio, 10);
    } else {
      datosParaGuardar.anio = null;
    }

    this.anexoService.actualizarAnexo(id, datosParaGuardar, eliminarArchivo).subscribe({
      next: () => {
        if (archivoNuevo) {
          this.anexoService.subirArchivoFisico(id, archivoNuevo).subscribe({
            next: () => {
              this.cargarDatos();
              this.cerrarModal();
              this.notifService.showSuccess('Cambios y nuevo archivo guardados');
            },
            error: (err) => {
              console.error("Error subiendo PDF al servidor:", err);
              alert('Los textos se guardaron, pero falló la subida del nuevo PDF.');
            }
          });
        } else if (eliminarArchivo) {
          // El archivo fue eliminado intencionalmente, sin reemplazar
          this.cargarDatos();
          this.cerrarModal();
          this.notifService.showSuccess('Cambios guardados. Archivo eliminado.');
        } else {
          this.cargarDatos();
          this.cerrarModal();
          this.notifService.showSuccess('Cambios guardados con éxito');
        }
      },
      error: (err) => {
        console.error("DETALLE DEL ERROR DE METADATOS:", err);
        alert('Error de conexión al actualizar los metadatos.');
      }
    });
  }

  // Función auxiliar para limpiar el código
  private finalizarGuardado(mensaje: string) {
    this.cargarDatos(); 
    this.cerrarModal();
    this.notifService.showSuccess(mensaje);
  }
  // Pequeña función de ayuda para no repetir código
  private finalizarActualizacion() {
    this.cargarDatos();
    this.cerrarModal();
    this.notifService.showSuccess('Cambios guardados con éxito');
  }

// ── Guard de navegación hacia atrás ──────────────────────
  private deactivateSubject = new Subject<boolean>();

  canDeactivate(): Observable<boolean> | boolean {
    if (!this.authService.estaLogueado()) return true;
    this.modalConfirmarSalida = true;
    this.cdr.detectChanges();
    return this.deactivateSubject.asObservable();
  }

  resolverNavegacion(confirmar: boolean): void {
    this.modalConfirmarSalida = false;
    if (confirmar) {
      this.authService.logout();
      this.deactivateSubject.next(true);
      this.deactivateSubject.complete();
      this.router.navigate(['/login']);
    } else {
      this.deactivateSubject.next(false);
      this.deactivateSubject.complete();
    }
    this.cdr.detectChanges();
  }

  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
  }

abrirModalCuenta(): void {
  // Pausamos la directiva ANTES de cerrar el menú,
  // para que la burbuja del clic no re-dispare clickOutside
  this.pausarClickOutside = true;
  this.menuAbierto = false;
  this.modalActivo.set('cuenta');
}

abrirModalUsuarios(): void {
  this.pausarClickOutside = true;
  this.menuAbierto = false;
  this.modalActivo.set('usuarios');
}

pedirConfirmacionSalida(): void {
  this.pausarClickOutside = true;
  this.menuAbierto = false;
  this.modalConfirmarSalida = true;
}

confirmarCerrarSesion() {
  this.modalConfirmarSalida = false;
  this.authService.logout(); // Ahora sí, matamos el token
  this.router.navigate(['/login']);
}
eliminarAnexo(id: number) {
    // 1. Clonamos el anexo antes de desaparecerlo, por si tenemos que restaurarlo
    const anexoEliminado = this.anexos.find(a => a.id === id);
    
    // 2. MAGIA UX: Lo sacamos de la lista INMEDIATAMENTE para que desaparezca de la tabla
    this.anexos = this.anexos.filter(a => a.id !== id);
    this.ejecutarFiltros(); // Refresca la vista al instante

    // 3. Disparamos la notificación pasando 2 caminos:
    this.notifService.showDelete(
      'Anexo eliminado. Deshacer (Ctrl+Z)', 
      
      // CAMINO A: El contador llega a cero (Confirmar Borrado Real en BD)
      () => {
        this.anexoService.eliminarAnexo(id).subscribe({
          next: () => {
            console.log('Borrado definitivo exitoso en BD');
            // Ya no hace falta recargar la tabla porque ya lo ocultamos en el paso 2
          },
          error: (err) => {
            console.error('Error borrando en BD:', err);
            // Si el servidor falla, se lo devolvemos a la tabla para que no se pierda
            if (anexoEliminado) this.anexos.push(anexoEliminado);
            this.ejecutarFiltros();
            alert('Fallo de conexión al eliminar en la base de datos.');
          }
        });
      },

      // CAMINO B: El usuario hace clic en "Deshacer" o presiona Ctrl+Z
      () => {
        // Volvemos a meter el anexo en la lista
        if (anexoEliminado) {
          this.anexos.push(anexoEliminado);
          // Ordenamos por ID para que vuelva exactamente a su posición original
          this.anexos.sort((a, b) => a.id - b.id);
          this.ejecutarFiltros(); // Refresca la vista y reaparece mágicamente
        }
      }
    );
  }
  calcularMetricasEnTiempoReal() {
    // 1. Total (reacciona a los filtros de la tabla)
    this.totalAnexosMetrica = this.anexosFiltrados.length;

    // 2. Actualizados: cuenta todos los anexos (del total, no solo filtrados)
    // modificados o creados en los últimos 10 días
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 10);
    this.actualizadosMetrica = this.anexos.filter(a => {
      const fechaDoc = new Date(a.fechaActualizacion || a.fechaSubida || 0);
      return fechaDoc >= fechaLimite;
    }).length;

    // 3. Años Cubiertos Matemático
    const aniosValidos = this.anexosFiltrados
      .map(a => parseInt(a.anio, 10))
      .filter(anio => !isNaN(anio)); // Filtramos basura
      
    if (aniosValidos.length > 0) {
      const min = Math.min(...aniosValidos);
      const max = Math.max(...aniosValidos);
      this.rangoAniosMetrica = (min === max) ? `${min}` : `${min} - ${max}`;
    } else {
      this.rangoAniosMetrica = '---';
    }
  }

  toggleFiltroActualizados() {
    this.filtroActualizadosActivo = !this.filtroActualizadosActivo;
    this.tablaAnexos?.resetearPaginacion();

    if (this.filtroActualizadosActivo) {
      this.anexoService.getAnexosActualizados().subscribe({
        next: (data: any[]) => {
          this.anexos = data;
          this.ejecutarFiltros();
        },
        error: (err: any) => {
          console.error('Error cargando actualizados:', err);
          this.filtroActualizadosActivo = false;
        }
      });
    } else {
      this.cargarDatos();
    }
  }

descargarAnexo(anexo: any) {
    // 0. Validación "anti-necios": Si no hay archivo físico, avisamos y matamos la función aquí.
    if (anexo.tieneArchivo === false || anexo.errorPdf) {
      this.notifService.showWarning('No se puede descargar: El administrador aún no ha subido el archivo físico.');
      return; 
    }

    // 1. Mostramos la notificación de "Descargando..." y guardamos su ID
    const toastId = this.notifService.showDownload(`Descargando ${anexo.nombre}...`);

    // 2. Pedimos el archivo físico al Backend
    this.anexoService.verArchivoFisico(anexo.id).subscribe({
      next: (blob: Blob) => {
        // 3. Magia de JS: Creamos una URL temporal en el navegador con el archivo
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Detectamos la extensión real del archivo según el tipo MIME del blob
        const mimeToExt: Record<string, string> = {
          'application/pdf': 'pdf',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
          'application/vnd.ms-excel': 'xls',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
          'application/msword': 'doc',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
          'application/vnd.ms-powerpoint': 'ppt',
          'text/plain': 'txt'
        };
        const ext = mimeToExt[blob.type] || 'pdf';
        a.download = `${anexo.nombre}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // 4. Cambiamos la notificación a "Descargado"
        this.notifService.completeDownload(toastId);
      },
      error: (err) => {
        this.notifService.remove(toastId);
        this.modalErrorAbierto = true; // Adiós alert feo, hola modal corporativo
      }
    });
  }
  // ==========================================
  // GESTIÓN DE CUENTA (PERFIL Y SEGURIDAD)
  // ==========================================
  
  // ==========================================
  // GESTIÓN DE CUENTA (PERFIL Y SEGURIDAD)
  // ==========================================
  
  actualizarPerfilUsuario(payload: {nombres: string, apellidos: string}) {
    this.authService.actualizarPerfil(payload).subscribe({
      next: () => {
        // Única responsabilidad: notificar a la fuente de verdad.
        // La vista se actualiza sola porque el template consume la señal.
        this.authService.actualizarUsuarioLocal(payload);
        this.notifService.showSuccess('Perfil actualizado correctamente');
      },
      error: (err) => {
        console.error('Error al actualizar perfil:', err);
        const msg = err.error?.error ?? 'No se pudo actualizar el perfil. Intenta de nuevo.';
        this.notifService.showWarning(msg);
      }
    });
  }

 verificarIdentidadUsuario(passwordActual: string) {
  this.authService.verificarPasswordActual(passwordActual).subscribe({
    next: () => {
      this.accountModalRef?.respuestaIdentidad(true);
    },
    error: () => {
      this.accountModalRef?.respuestaIdentidad(false);
    }
  });
}
  _identidadResultado: boolean | null = null;

  actualizarPasswordUsuario(payload: {actual: string, nueva: string}) {
    this.authService.actualizarPassword(payload).subscribe({
      next: () => {
        this.notifService.showSuccess('Contraseña actualizada correctamente');
      },
      error: (err) => {
        console.error('Error al cambiar contraseña:', err);
        // Mostrar error exacto del backend (ej: "Contraseña actual incorrecta")
        const msg = err.error?.error ?? 'La contraseña actual es incorrecta.';
        
        // Asumiendo que tienes un showError, o usamos showWarning si no lo tienes
        this.notifService.showWarning(msg);
      }
    });
  }
}