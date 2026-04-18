import {
  Directive, ElementRef, Output,
  EventEmitter, HostListener, Input
} from '@angular/core';

@Directive({
  selector: '[clickOutside]',
  standalone: true
})
export class ClickOutsideDirective {

  @Output() clickOutside = new EventEmitter<void>();

  // ── Flag de guardia ──────────────────────────────────────────
  // Cuando el padre necesita cerrar el menú programáticamente
  // (no por un clic externo real), activa este flag para que
  // la directiva ignore el evento de burbuja del mismo clic.
  @Input() set pauseClickOutside(pausing: boolean) {
    if (pausing) {
      this._paused = true;
      // Se reactiva automáticamente en el siguiente macrotask,
      // cuando la burbuja del evento ya terminó completamente.
      setTimeout(() => { this._paused = false; }, 0);
    }
  }

  private _paused = false;

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event.target'])
  public onClick(targetElement: EventTarget | null): void {
  if (!(targetElement instanceof HTMLElement)) return;
    // 1. Si estamos en pausa, ignoramos (el cierre fue intencional)
    if (this._paused) return;

    // 2. Si el host ya no está en el DOM, ignoramos
    if (!targetElement || !document.body.contains(this.elementRef.nativeElement)) {
      return;
    }

    // 3. Si el clic fue dentro del elemento host, ignoramos
    const clickedInside = this.elementRef.nativeElement.contains(targetElement);
    if (!clickedInside) {
      this.clickOutside.emit();
    }
  }
}