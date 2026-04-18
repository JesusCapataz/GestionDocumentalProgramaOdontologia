import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-upload-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './upload-modal.html',
  styleUrl: './upload-modal.css'
})
export class UploadModalComponent implements OnChanges { 
  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() guardar = new EventEmitter<any>(); // 👈 Le avisamos al papá que hay datos listos

  // El objeto que guardará lo que escribas
  nuevoAnexo: any = { nombre: '', anio: '', categoriaPrincipal: '', categoriaSecundaria: '', descripcion: '', numeroAnexo: '', tipoDocumento: '', fuente: '' };
  archivoSeleccionado: File | null = null;

  // Banderas de UX para poner los bordes rojos
  errorNombre = false;
  errorCatPrin = false;
  errorCatSec = false;
  errorAnio = false;
  errorArchivo = false;
  isSubmitting = false;

  seleccionarArchivo(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.archivoSeleccionado = input.files[0];
      this.errorArchivo = false; // UX: Si elige archivo, quitamos el error
      // Autocompletar el nombre sin la extensión (Como lo tenías en tu monolito)
      if (!this.nuevoAnexo.nombre) {
        this.nuevoAnexo.nombre = this.archivoSeleccionado.name.replace(/\.[^/.]+$/, "");
        this.errorNombre = false;
      }
    }
  }
// UX: Interceptor de teclado para el Año
  aplicarTitleCase(campo: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.nuevoAnexo[campo] = val
      .split(' ')
      .map((w: string) => w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)
      .join(' ');
  }

  normalizarNumero(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.nuevoAnexo.numeroAnexo = input.value.toUpperCase();
  }

  normalizarFuente(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.nuevoAnexo.fuente = input.value.replace(/[^0-9]/g, '');
    input.value = this.nuevoAnexo.fuente;
  }

  verificarTeclaAnio(event: KeyboardEvent) {
    const teclasPermitidas = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Enter'];
    // Si NO es número y NO es tecla especial, lo bloqueamos
    if (!teclasPermitidas.includes(event.key) && !/^[0-9]$/.test(event.key)) {
      event.preventDefault(); // Bloquea la letra
      this.errorAnio = true;  // Parpadeo rojo
      setTimeout(() => this.errorAnio = false, 800); // Quita el rojo rápido
    }
  }
  validarYEnviar() {
    if (this.isSubmitting) return;
    // Leyes de UX: Validación estricta
    this.errorNombre = !this.nuevoAnexo.nombre || this.nuevoAnexo.nombre.trim() === '';
    this.errorCatPrin = !this.nuevoAnexo.categoriaPrincipal;
    this.errorCatSec = !this.nuevoAnexo.categoriaSecundaria;
    this.errorArchivo = false; // El archivo es opcional — se puede subir después

    // Validar el año (Rango 1900 - 2100)
    // Validar el año (4 dígitos exactos, Rango 1900 - 2100)
    if (this.nuevoAnexo.anio) {
      const strAnio = String(this.nuevoAnexo.anio).trim();
      const numAnio = parseInt(strAnio, 10);
      this.errorAnio = strAnio.length !== 4 || numAnio < 1900 || numAnio > 2100;
    } else {
      this.errorAnio = false; 
    }

    if (this.errorNombre || this.errorCatPrin || this.errorCatSec || this.errorAnio || this.errorArchivo) {
      return; // 🛑 UX: No dejamos pasar si hay errores (se pondrán rojos los bordes)
    }

    // Si todo está perfecto, empaquetamos y mandamos al Dashboard
    this.isSubmitting = true;
    this.guardar.emit({
      datos: this.nuevoAnexo,
      archivo: this.archivoSeleccionado
    });
  }

  limpiarYCerrar() {
    this.nuevoAnexo = { nombre: '', anio: '', categoriaPrincipal: '', categoriaSecundaria: '', descripcion: '', numeroAnexo: '', tipoDocumento: '', fuente: '' };
    this.archivoSeleccionado = null;
    this.errorNombre = false; this.errorCatPrin = false; this.errorCatSec = false; this.errorAnio = false; this.errorArchivo = false;
    this.isSubmitting = false;
    this.close.emit();
  }

  ngOnChanges(): void {
    if (!this.isOpen) {
      this.nuevoAnexo = { nombre: '', anio: '', categoriaPrincipal: '', categoriaSecundaria: '', descripcion: '', numeroAnexo: '', tipoDocumento: '', fuente: '' };
      this.archivoSeleccionado = null;
      this.errorNombre = false; this.errorCatPrin = false; this.errorCatSec = false; this.errorAnio = false; this.errorArchivo = false;
      this.isSubmitting = false;
    }
  }
}