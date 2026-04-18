import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-modal.html',
  styleUrl: './edit-modal.css'
})
export class EditModalComponent implements OnChanges { 
  @Input() isOpen: boolean = false;
  @Input() anexoSeleccionado: any = {}; 
  @Output() close = new EventEmitter<void>();
  @Output() guardar = new EventEmitter<any>();

  anexoLocal: any = {};
  archivoNuevo: File | null = null;
  nombreArchivoNuevo: string = '';
  archivoEliminadoIntencionalmente = false; // ← flag del bug
  errorAnio = false;
  errorNombre = false;
  isSubmitting = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['anexoSeleccionado'] && this.anexoSeleccionado) {
      this.anexoLocal = { 
        ...this.anexoSeleccionado,
        numeroAnexo: this.anexoSeleccionado.numeroAnexo ?? '',
        tipoDocumento: this.anexoSeleccionado.tipoDocumento ?? '',
        fuente: this.anexoSeleccionado.fuente ?? ''
      }; 
      this.archivoNuevo = null;
      this.archivoEliminadoIntencionalmente = false;
      this.isSubmitting = false;
    }
    if (changes['isOpen'] && !this.isOpen) {
      this.isSubmitting = false;
    }
  }

onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.archivoNuevo = file;
      this.nombreArchivoNuevo = file.name; 
      this.anexoLocal.tieneArchivo = true; 
    }
  }
  eliminarArchivoVisual() {
    // Si tenía archivo preexistente (no recién seleccionado), marcamos intención de borrado
    if (!this.archivoNuevo) {
      this.archivoEliminadoIntencionalmente = true;
    }
    this.anexoLocal.tieneArchivo = false;
    this.archivoNuevo = null;
  }
  
  aplicarTitleCase(campo: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.anexoLocal[campo] = val
      .split(' ')
      .map((w: string) => w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)
      .join(' ');
  }

  normalizarNumero(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.anexoLocal.numeroAnexo = input.value.toUpperCase();
  }

  normalizarFuente(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.anexoLocal.fuente = input.value.replace(/[^0-9]/g, '');
    input.value = this.anexoLocal.fuente;
  }

  verificarTeclaAnio(event: KeyboardEvent) {
    const teclasPermitidas = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Enter'];
    if (!teclasPermitidas.includes(event.key) && !/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      this.errorAnio = true;
      setTimeout(() => this.errorAnio = false, 800);
    }
  }
  @HostListener('document:keydown.enter', ['$event'])
  onEnter(event: Event): void {
    if (!this.isOpen) return;
    if ((document.activeElement?.tagName || '').toLowerCase() === 'textarea') return;
    event.preventDefault();
    this.validarYGuardar();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.isOpen) return;
    this.close.emit();
  }

  validarYGuardar() {
    this.errorNombre = !this.anexoLocal.nombre || this.anexoLocal.nombre.trim() === '';

    if (this.anexoLocal.anio) {
      const strAnio = String(this.anexoLocal.anio).trim();
      const numAnio = parseInt(strAnio, 10);
      this.errorAnio = strAnio.length !== 4 || numAnio < 1900 || numAnio > 2100;
    } else {
      this.errorAnio = false;
    }

    if (this.errorNombre || this.errorAnio) return; 

    const anexoLimpio = {
      id: this.anexoLocal.id,
      nombre: this.anexoLocal.nombre,
      anio: this.anexoLocal.anio,
      categoriaPrincipal: this.anexoLocal.categoriaPrincipal,
      categoriaSecundaria: this.anexoLocal.categoriaSecundaria,
      descripcion: this.anexoLocal.descripcion,
      tieneArchivo: this.anexoLocal.tieneArchivo,
      numeroAnexo: this.anexoLocal.numeroAnexo || '',
      tipoDocumento: this.anexoLocal.tipoDocumento || '',
      fuente: this.anexoLocal.fuente || ''
    };

    this.isSubmitting = true;
    this.guardar.emit({
      datos: anexoLimpio,
      archivo: this.archivoNuevo,
      eliminarArchivo: this.archivoEliminadoIntencionalmente
    });
  }
}