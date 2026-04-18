import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-anexos-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './anexos-table.html',
  styleUrl: './anexos-table.css'
})
export class AnexosTableComponent implements OnInit, OnDestroy {
  @Input() datos: any[] = [];
  @Input() listaAnios: string[] = [];
  @Input() rolExterior: string = '';
  @Output() buscar = new EventEmitter<any>();
  @Output() solicitarModal = new EventEmitter<any>();
  @Output() eliminar = new EventEmitter<number>();
  @Input() mostrandoActualizados: boolean = false;
  @Output() descargar = new EventEmitter<any>();


 texto: string = '';
  catPrin: string = '';
  catSec: string = '';
  anio: string = '';
  rolActual: string = '';

  // ── Row Selection ────────────────────────────────────────
  selectedRows = new Set<number>();
  expandedRows = new Set<number>();
  private lastClickedIndex: number | null = null;
  private busquedaSubject = new Subject<string>();

  get selectedCount(): number { return this.selectedRows.size; }
  get hasSelection(): boolean { return this.selectedRows.size > 0; }
  isSelected(id: number): boolean { return this.selectedRows.has(id); }

  get anexosSeleccionados(): any[] {
    return this.datos.filter(a => this.selectedRows.has(a.id));
  }

  onRowClick(event: MouseEvent, anexo: any, indexEnPagina: number): void {
    const target = event.target as HTMLElement;
    if (target.closest('.action-btn') || target.closest('.actions')) return;

    const id = anexo.id;
    const globalIndex = (this.paginaActual - 1) * this.PAGE_SIZE + indexEnPagina;

    if (event.shiftKey && this.lastClickedIndex !== null) {
      const start = Math.min(this.lastClickedIndex, globalIndex);
      const end   = Math.max(this.lastClickedIndex, globalIndex);
      for (let i = start; i <= end; i++) {
        if (this.datos[i]) this.selectedRows.add(this.datos[i].id);
      }
    } else if (event.ctrlKey || event.metaKey) {
      if (this.selectedRows.has(id)) {
        this.selectedRows.delete(id);
      } else {
        this.selectedRows.add(id);
      }
    } else {
      if (this.selectedRows.size === 1 && this.selectedRows.has(id)) {
        this.selectedRows.clear();
      } else {
        this.selectedRows.clear();
        this.selectedRows.add(id);
      }
    }
    this.lastClickedIndex = globalIndex;
  }

  clearSelection(): void {
    this.selectedRows.clear();
    this.lastClickedIndex = null;
  }

  toggleExpand(event: MouseEvent, id: number): void {
    event.stopPropagation();
    if (this.expandedRows.has(id)) {
      this.expandedRows.delete(id);
    } else {
      this.expandedRows.add(id);
    }
  }

  isExpanded(id: number): boolean {
    return this.expandedRows.has(id);
  }

  tieneDetalles(anexo: any): boolean {
    return !!(anexo.numeroAnexo || anexo.tipoDocumento || anexo.fuente);
  }

  abrirPreviewSeleccionado(): void {
    const primero = this.anexosSeleccionados[0];
    if (primero) this.solicitarModal.emit({ tipo: 'preview', data: primero });
  }

  abrirEditSeleccionado(): void {
    const primero = this.anexosSeleccionados[0];
    if (primero) this.solicitarModal.emit({ tipo: 'edit', data: primero });
  }

  descargarSeleccionados(): void {
    this.anexosSeleccionados.forEach(a => this.descargar.emit(a));
    this.clearSelection();
  }

  eliminarSeleccionados(): void {
    this.anexosSeleccionados.forEach(a => this.eliminar.emit(a.id));
    this.clearSelection();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;
    if (document.querySelector('.modal-backdrop.is-open')) return;

    const isAdmin = this.rolActual === 'ADMINISTRADOR' || this.rolActual === 'SUPER_ADMIN';

    switch (event.key) {
      case 'Escape':
        if (this.hasSelection) { event.preventDefault(); this.clearSelection(); }
        break;
      case 'Enter':
        if (this.selectedCount === 1) { event.preventDefault(); this.abrirPreviewSeleccionado(); }
        break;
      case 'e': case 'E':
        if (this.selectedCount === 1 && isAdmin) { event.preventDefault(); this.abrirEditSeleccionado(); }
        break;
      case 'Delete': case 'Backspace':
        if (this.hasSelection && isAdmin) { event.preventDefault(); this.eliminarSeleccionados(); }
        break;
      case 'ArrowDown':
        event.preventDefault(); this.moverSeleccion(1); break;
      case 'ArrowUp':
        event.preventDefault(); this.moverSeleccion(-1); break;
      case 'a': case 'A':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.datosPaginados.forEach(a => this.selectedRows.add(a.id));
        }
        break;
      case 's': case 'S':
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          // Si ya están todos seleccionados, deselecciona — toggle
          const todosSeleccionados = this.datosPaginados.every(a => this.selectedRows.has(a.id));
          if (todosSeleccionados) {
            this.datosPaginados.forEach(a => this.selectedRows.delete(a.id));
          } else {
            this.datosPaginados.forEach(a => this.selectedRows.add(a.id));
          }
        }
        break;
      
    }
  }

  private moverSeleccion(delta: number): void {
    const paginados = this.datosPaginados;
    if (paginados.length === 0) return;

    const selectedInPage = paginados
      .map((a, i) => ({ id: a.id, i }))
      .filter(x => this.selectedRows.has(x.id));

    let nextIndex: number;
    if (selectedInPage.length === 0) {
      nextIndex = delta > 0 ? 0 : paginados.length - 1;
    } else {
      const lastI = selectedInPage[selectedInPage.length - 1].i;
      nextIndex = Math.max(0, Math.min(paginados.length - 1, lastI + delta));
    }

    this.selectedRows.clear();
    this.selectedRows.add(paginados[nextIndex].id);

    setTimeout(() => {
      const rows = document.querySelectorAll('#tableBody tr');
      if (rows[nextIndex]) {
        (rows[nextIndex] as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

  readonly PAGE_SIZE = 10;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.ceil(this.datos.length / this.PAGE_SIZE);
  }

  get datosPaginados(): any[] {
    const inicio = (this.paginaActual - 1) * this.PAGE_SIZE;
    return this.datos.slice(inicio, inicio + this.PAGE_SIZE);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  irAPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.paginaActual = p;
  }
  resetearPaginacion(): void {
    this.paginaActual = 1;
  }

  ngOnInit(): void {
    this.rolActual = this.rolExterior || localStorage.getItem('rol') || '';
    this.busquedaSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(() => {
      this.paginaActual = 1;
      this.buscar.emit({
        texto: this.texto,
        cat1: this.catPrin,
        cat2: this.catSec,
        anio: this.anio
      });
    });
  }

  ngOnDestroy(): void {
    this.clearSelection();
    this.busquedaSubject.complete();
  }

  notificarBusqueda() {
    this.busquedaSubject.next(this.texto);
  }

  notificarBusquedaInmediata() {
    this.paginaActual = 1;
    this.buscar.emit({
      texto: this.texto,
      cat1: this.catPrin,
      cat2: this.catSec,
      anio: this.anio
    });
  }

  limpiar() {
    this.texto = ''; this.catPrin = ''; this.catSec = ''; this.anio = '';
    this.notificarBusquedaInmediata();
  }
  readonly Math = Math;
}