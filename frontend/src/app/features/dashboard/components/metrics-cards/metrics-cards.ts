import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-metrics-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metrics-cards.html',
  styleUrl: './metrics-cards.css'
})
export class MetricsCardsComponent {
  // Las variables (Inputs) que reciben la info del Dashboard
  @Input() total: number = 0;
  @Input() actualizados: number = 0;
  @Input() rangoAnios: string = '---';
  @Input() filtroActualizadosActivo: boolean = false;
  @Input() isLoadingActualizados: boolean = false;

  // El transmisor (Output) que grita cuando haces clic
  @Output() toggleActualizados = new EventEmitter<void>();
}