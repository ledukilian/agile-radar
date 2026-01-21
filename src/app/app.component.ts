import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Estimation, DimensionWeights, TShirtSize, TShirtSizesConfig } from './models/estimation.model';
import { EstimationFormComponent } from './components/estimation-form/estimation-form.component';
import { RadarChartComponent } from './components/radar-chart/radar-chart.component';
import { EstimationListComponent } from './components/estimation-list/estimation-list.component';
import { EstimationService } from './services/estimation.service';
import { SettingsService } from './services/settings.service';
import { TourService } from './services/tour.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EstimationFormComponent,
    RadarChartComponent,
    EstimationListComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, AfterViewInit {
  selectedEstimation?: Estimation;
  appVersion = environment.version;
  isDarkMode = false;
  isEditing = false;
  mobileTab: 'list' | 'chart' | 'form' = 'list';
  
  // Paramètres
  showSettingsModal = false;
  settingsTab: 'general' | 'weights' | 'tshirt' = 'general';
  defaultAuthorSetting = '';
  private readonly AUTHOR_STORAGE_KEY = 'agile-radar-default-author';
  
  // Paramètres avancés (multiplicateurs)
  dimensionWeights: DimensionWeights = {
    complexity: 1.5,
    uncertainty: 2,
    risk: 2,
    size: 1,
    effort: 1
  };
  tShirtSizes: TShirtSize[] = []; // Deprecated
  tShirtSizesConfig: TShirtSizesConfig = {
    userStory: [],
    feature: []
  };

  constructor(
    private estimationService: EstimationService,
    private settingsService: SettingsService,
    private tourService: TourService
  ) {}

  ngOnInit(): void {
    // Charger la préférence de thème depuis le localStorage
    const savedTheme = localStorage.getItem('agile-radar-theme');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
    }
    // Par défaut : mode clair (isDarkMode = false)
  }

  ngAfterViewInit(): void {
    // Lancer le tour automatiquement pour les nouveaux utilisateurs
    setTimeout(() => {
      if (!this.tourService.isTourCompleted()) {
        this.tourService.startTour();
      }
    }, 500);
  }

  /**
   * Lance ou relance le tour guidé
   */
  startTour(): void {
    this.tourService.resetTour();
    this.tourService.startTour();
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

  /**
   * Ouvre la modale des paramètres et charge les valeurs actuelles
   */
  openSettingsModal(): void {
    try {
      this.defaultAuthorSetting = localStorage.getItem(this.AUTHOR_STORAGE_KEY) || '';
    } catch {
      this.defaultAuthorSetting = '';
    }
    // Charger les paramètres avancés
    this.dimensionWeights = { ...this.settingsService.getDimensionWeights() };
    const config = this.settingsService.getTShirtSizesConfig();
    this.tShirtSizesConfig = {
      userStory: config.userStory.map(s => ({ ...s })),
      feature: config.feature.map(s => ({ ...s }))
    };
    this.settingsTab = 'general';
    this.showSettingsModal = true;
  }

  /**
   * Sauvegarde les paramètres
   */
  saveSettings(): void {
    try {
      // Sauvegarder l'auteur par défaut
      if (this.defaultAuthorSetting.trim()) {
        localStorage.setItem(this.AUTHOR_STORAGE_KEY, this.defaultAuthorSetting.trim());
      } else {
        localStorage.removeItem(this.AUTHOR_STORAGE_KEY);
      }
      
      // Sauvegarder les paramètres avancés
      this.settingsService.updateDimensionWeights(this.dimensionWeights);
      this.settingsService.updateTShirtSizesConfig(this.tShirtSizesConfig);
    } catch {
      // Ignore localStorage errors
    }
    this.showSettingsModal = false;
  }

  /**
   * Réinitialise les poids des dimensions aux valeurs par défaut
   */
  resetWeights(): void {
    this.dimensionWeights = { ...this.settingsService.getDefaultDimensionWeights() };
  }

  /**
   * Réinitialise les tailles T-shirt aux valeurs par défaut
   */
  resetTShirtSizes(): void {
    const defaultConfig = this.settingsService.getDefaultTShirtSizesConfig();
    this.tShirtSizesConfig = {
      userStory: defaultConfig.userStory.map(s => ({ ...s })),
      feature: defaultConfig.feature.map(s => ({ ...s }))
    };
  }

  /**
   * Labels français pour les dimensions
   */
  dimensionLabels: { [key: string]: string } = {
    complexity: 'Complexité',
    uncertainty: 'Incertitude',
    risk: 'Risque',
    size: 'Taille',
    effort: 'Effort'
  };

  /**
   * Liste des clés de dimensions pour l'itération
   */
  dimensionKeys: (keyof DimensionWeights)[] = ['complexity', 'uncertainty', 'risk', 'size', 'effort'];

  /**
   * Récupère le poids d'une dimension
   */
  getWeight(key: keyof DimensionWeights): number {
    return this.dimensionWeights[key];
  }

  /**
   * Met à jour le poids d'une dimension
   */
  setWeight(key: keyof DimensionWeights, value: number): void {
    this.dimensionWeights[key] = value;
  }
}
