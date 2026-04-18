import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { Pipe, PipeTransform, inject } from '@angular/core';

@Pipe({ name: 'safeResourceUrl', standalone: true })
export class SafeResourceUrlPipe implements PipeTransform {
  private san = inject(DomSanitizer);
  transform(url: string) {
    if (!url) return '';
    return this.san.bypassSecurityTrustResourceUrl(url);
  }
}

@Component({
  selector: 'app-pdf-viewer-modal',
  standalone: true,
  imports: [CommonModule, SafeResourceUrlPipe],  templateUrl: './pdf-viewer-modal.html',
  styleUrl: './pdf-viewer-modal.css'
})
export class PdfViewerModalComponent {
  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Input() anexoSeleccionado: any = {};
  @Output() descargar = new EventEmitter<any>();
}