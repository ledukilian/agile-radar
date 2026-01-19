import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Estimation } from './models/estimation.model';
import { EstimationFormComponent } from './components/estimation-form/estimation-form.component';
import { RadarChartComponent } from './components/radar-chart/radar-chart.component';
import { EstimationListComponent } from './components/estimation-list/estimation-list.component';
import { EstimationService } from './services/estimation.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    EstimationFormComponent,
    RadarChartComponent,
    EstimationListComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  selectedEstimation?: Estimation;
  appVersion = environment.version;

  constructor(private estimationService: EstimationService) {}

  ngOnInit(): void {
    // Au démarrage, ne pas sélectionner automatiquement d'estimation
    // L'utilisateur doit cliquer sur "Nouvelle" ou sélectionner une estimation existante
  }

  onSelectEstimation(estimation: Estimation | null): void {
    this.selectedEstimation = estimation || undefined;
  }

  onEstimationChanged(estimation: Estimation | null): void {
    if (estimation) {
      // Mettre à jour l'estimation sélectionnée pour le live update
      this.selectedEstimation = estimation;
    }
  }

  onDeleteEstimation(id: string): void {
    this.estimationService.deleteEstimation(id);
    if (this.selectedEstimation?.id === id) {
      // Après suppression, ne plus afficher d'estimation
      this.selectedEstimation = undefined;
    }
  }
}
