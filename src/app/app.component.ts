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
  isDarkMode = false;
  isEditing = false;
  mobileTab: 'list' | 'chart' | 'form' = 'list';

  constructor(private estimationService: EstimationService) {}

  ngOnInit(): void {
    // Charger la préférence de thème depuis le localStorage
    const savedTheme = localStorage.getItem('agile-radar-theme');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
    }
    // Par défaut : mode clair (isDarkMode = false)
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('agile-radar-theme', this.isDarkMode ? 'dark' : 'light');
  }

  onSelectEstimation(estimation: Estimation | null): void {
    this.selectedEstimation = estimation || undefined;
    // Mode consultation par défaut lors de la sélection
    this.isEditing = false;
    // Sur mobile, passer au tab chart quand on sélectionne une estimation
    if (estimation) {
      this.mobileTab = 'chart';
    }
  }

  onNewEstimationCreated(estimation: Estimation): void {
    this.selectedEstimation = estimation;
    // Mode édition directement pour une nouvelle estimation
    this.isEditing = true;
    // Sur mobile, passer au tab form pour la nouvelle estimation
    this.mobileTab = 'form';
  }

  onStartEditing(): void {
    this.isEditing = true;
    // Sur mobile, passer au tab form
    this.mobileTab = 'form';
  }

  onStopEditing(): void {
    this.isEditing = false;
    this.mobileTab = 'chart';
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
