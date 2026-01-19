import { Component, OnInit, OnChanges, Input, Output, EventEmitter, ViewChild, ElementRef, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartData, registerables } from 'chart.js';
import { Estimation } from '../../models/estimation.model';
import { SettingsService } from '../../services/settings.service';
import { EstimationService, Recommendation } from '../../services/estimation.service';
import * as htmlToImage from 'html-to-image';

Chart.register(...registerables);

@Component({
  selector: 'app-radar-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './radar-chart.component.html',
  styleUrl: './radar-chart.component.scss'
})
export class RadarChartComponent implements OnInit, OnChanges {
  @Input() estimation?: Estimation;
  @Input() showEditButton: boolean = false;
  @Input() isEditing: boolean = false;
  @Output() editEstimation = new EventEmitter<void>();
  @Output() closeEdit = new EventEmitter<void>();
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('exportContainer', { static: true }) exportContainer!: ElementRef<HTMLDivElement>;
  
  private chart?: Chart;
  isExporting = false;
  copySuccess = false;
  showRecommendations = false;

  // T-shirt sizes avec leurs ranges de points de complexité (progression Fibonacci)
  tShirtSizes = [
    { size: 'XS', min: 1, max: 3, bgColor: 'bg-green-100', textColor: 'text-green-700', ringColor: 'ring-green-500', fillColor: 'rgba(34, 197, 94, 0.25)', borderColor: 'rgba(34, 197, 94, 1)' },
    { size: 'S', min: 3, max: 8, bgColor: 'bg-lime-100', textColor: 'text-lime-700', ringColor: 'ring-lime-500', fillColor: 'rgba(132, 204, 22, 0.25)', borderColor: 'rgba(132, 204, 22, 1)' },
    { size: 'M', min: 8, max: 21, bgColor: 'bg-yellow-100', textColor: 'text-yellow-700', ringColor: 'ring-yellow-500', fillColor: 'rgba(234, 179, 8, 0.25)', borderColor: 'rgba(234, 179, 8, 1)' },
    { size: 'L', min: 21, max: 55, bgColor: 'bg-orange-100', textColor: 'text-orange-700', ringColor: 'ring-orange-500', fillColor: 'rgba(249, 115, 22, 0.25)', borderColor: 'rgba(249, 115, 22, 1)' },
    { size: 'XL', min: 55, max: 144, bgColor: 'bg-red-100', textColor: 'text-red-700', ringColor: 'ring-red-500', fillColor: 'rgba(239, 68, 68, 0.25)', borderColor: 'rgba(239, 68, 68, 1)' },
    { size: 'XXL', min: 144, max: 377, bgColor: 'bg-purple-100', textColor: 'text-purple-700', ringColor: 'ring-purple-500', fillColor: 'rgba(168, 85, 247, 0.25)', borderColor: 'rgba(168, 85, 247, 1)' }
  ];

  // Graduations pour le calcul
  private graduations = {
    complexity: [
      { label: 'Aucune', value: 0 },
      { label: 'Simple', value: 25 },
      { label: 'Modérée', value: 50 },
      { label: 'Complexe', value: 75 },
      { label: 'Extrême', value: 100 }
    ],
    uncertainty: [
      { label: 'Aucune', value: 0 },
      { label: 'Faible', value: 25 },
      { label: 'Modérée', value: 50 },
      { label: 'Élevée', value: 75 },
      { label: 'Totale', value: 100 }
    ],
    risk: [
      { label: 'Aucun', value: 0 },
      { label: 'Faible', value: 25 },
      { label: 'Modéré', value: 50 },
      { label: 'Élevé', value: 75 },
      { label: 'Critique', value: 100 }
    ],
    size: [
      { label: 'Minuscule', value: 0 },
      { label: 'Petit', value: 25 },
      { label: 'Moyen', value: 50 },
      { label: 'Grand', value: 75 },
      { label: 'Énorme', value: 100 }
    ],
    effort: [
      { label: 'Fluide', value: 0 },
      { label: 'Supportable', value: 25 },
      { label: 'Demandant', value: 50 },
      { label: 'Pénible', value: 75 },
      { label: 'Éprouvant', value: 100 }
    ]
  };

  constructor(
    private settingsService: SettingsService,
    private estimationService: EstimationService
  ) {}

  ngOnInit(): void {
    this.createChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['estimation']) {
      if (this.chart) {
        this.updateChart();
      } else {
        // Si le chart n'existe pas encore, le créer
        setTimeout(() => {
          if (!this.chart) {
            this.createChart();
          } else {
            this.updateChart();
          }
        }, 0);
      }
    }
  }

  private createChart(): void {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration<'radar'> = {
      type: 'radar',
      data: this.getChartData(),
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            startAngle: 0,
            ticks: {
              stepSize: 20,
              display: false
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            },
            pointLabels: {
              font: {
                size: 13,
                weight: 'bold'
              },
              color: (context) => {
                // Couleurs correspondant aux badges CURSE
                const colors = [
                  'rgba(234, 179, 8, 1)',    // Complexity - Yellow
                  'rgba(147, 51, 234, 1)',   // Uncertainty - Purple
                  'rgba(239, 68, 68, 1)',    // Risk - Red
                  'rgba(34, 197, 94, 1)',    // Size - Green
                  'rgba(59, 130, 246, 1)'    // Effort - Blue
                ];
                return colors[context.index] || '#374151';
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.parsed.r;
                const taille = this.getTailleByValue(value);
                return `${label}: ${taille?.label || value} (${taille?.description || ''})`;
              }
            }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }

  private getChartData(): ChartData<'radar'> {
    if (!this.estimation) {
      return {
        labels: ['Complexité', 'Incertitude', 'Risque', 'Taille', 'Effort'],
        datasets: []
      };
    }

    // Obtenir la couleur basée sur la T-shirt size
    const tShirt = this.getTShirtSize();

    // Utiliser directement les valeurs numériques (système analogique)
    return {
      labels: ['Complexité', 'Incertitude', 'Risque', 'Taille', 'Effort'],
      datasets: [
        {
          label: this.estimation.name,
          data: [
            this.estimation.complexity,
            this.estimation.uncertainty,
            this.estimation.risk,
            this.estimation.size,
            this.estimation.effort
          ],
          backgroundColor: tShirt.fillColor,
          borderColor: tShirt.borderColor,
          borderWidth: 2,
          pointBackgroundColor: [
            'rgba(234, 179, 8, 1)',    // Complexity - Yellow
            'rgba(147, 51, 234, 1)',   // Uncertainty - Purple
            'rgba(220, 38, 38, 1)',    // Risk - Red
            'rgba(22, 163, 74, 1)',    // Size - Green
            'rgba(59, 130, 246, 1)'    // Effort - Blue
          ],
          pointBorderColor: '#fff',
          pointRadius: 8,
          pointHoverRadius: 10,
          pointHoverBackgroundColor: [
            'rgba(234, 179, 8, 1)',    // Complexity - Yellow
            'rgba(147, 51, 234, 1)',   // Uncertainty - Purple
            'rgba(220, 38, 38, 1)',    // Risk - Red
            'rgba(22, 163, 74, 1)',    // Size - Green
            'rgba(59, 130, 246, 1)'    // Effort - Blue
          ],
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 3
        }
      ]
    };
  }

  private updateChart(): void {
    if (this.chart) {
      this.chart.data = this.getChartData();
      this.chart.update('none'); // 'none' pour une mise à jour plus fluide sans animation
    }
  }

  private getTailleByValue(value: number): { label: string; value: number; description?: string } | undefined {
    const tailles = this.settingsService.getTailles();
    // Trouver la taille la plus proche
    return tailles.reduce((prev, curr) => 
      Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev
    );
  }

  /**
   * Calcule la moyenne CURSE (0-100) à partir des 5 axes de l'estimation
   */
  getCurseAverage(): number {
    if (!this.estimation) return 0;
    
    // Utiliser directement les valeurs numériques
    return (
      this.estimation.complexity +
      this.estimation.uncertainty +
      this.estimation.risk +
      this.estimation.size +
      this.estimation.effort
    ) / 5;
  }

  /**
   * Calcule les points de complexité à partir du score CURSE moyen
   */
  calculateComplexityPoints(): number {
    const curseAverage = this.getCurseAverage();
    const normalized = curseAverage / 100;
    const points = Math.pow(377, normalized);
    return Math.round(points * 10) / 10;
  }

  /**
   * Retourne les points de complexité arrondis au supérieur
   */
  getComplexityPointsCeil(): number {
    return Math.ceil(this.calculateComplexityPoints());
  }

  /**
   * Détermine la T-shirt size en fonction des points de complexité
   */
  getTShirtSize(): { size: string; min: number; max: number; bgColor: string; textColor: string; fillColor: string; borderColor: string } {
    const points = this.calculateComplexityPoints();
    
    for (const tShirt of this.tShirtSizes) {
      if (points < tShirt.max) {
        return tShirt;
      }
    }
    return this.tShirtSizes[this.tShirtSizes.length - 1];
  }

  /**
   * Retourne la valeur numérique (0-100) pour une dimension CURSE donnée
   */
  getValueForDimension(dimension: 'complexity' | 'uncertainty' | 'risk' | 'size' | 'effort'): number {
    if (!this.estimation) return 0;
    // Utiliser directement la valeur numérique
    return this.estimation[dimension];
  }

  /**
   * Retourne l'index de graduation le plus proche pour une dimension (pour afficher les niveaux)
   */
  getGraduationIndex(dimension: 'complexity' | 'uncertainty' | 'risk' | 'size' | 'effort'): number {
    if (!this.estimation) return 0;
    const value = this.estimation[dimension];
    const grads = this.graduations[dimension];
    // Trouver la graduation la plus proche
    let closestIndex = 0;
    let closestDiff = Math.abs(grads[0].value - value);
    for (let i = 1; i < grads.length; i++) {
      const diff = Math.abs(grads[i].value - value);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = i;
      }
    }
    return closestIndex;
  }

  /**
   * Retourne le nombre total de graduations pour une dimension
   */
  getGraduationCount(dimension: 'complexity' | 'uncertainty' | 'risk' | 'size' | 'effort'): number {
    return this.graduations[dimension].length;
  }

  /**
   * Retourne toutes les graduations pour une dimension
   */
  getGraduations(dimension: 'complexity' | 'uncertainty' | 'risk' | 'size' | 'effort'): { label: string; value: number }[] {
    return this.graduations[dimension];
  }

  /**
   * Retourne le label de la graduation la plus proche pour une dimension donnée
   */
  getClosestGraduationLabel(dimension: 'complexity' | 'uncertainty' | 'risk' | 'size' | 'effort'): string {
    if (!this.estimation) return '';
    const value = this.estimation[dimension];
    const grads = this.graduations[dimension];
    // Trouver la graduation la plus proche
    let closest = grads[0];
    let closestDiff = Math.abs(grads[0].value - value);
    for (let i = 1; i < grads.length; i++) {
      const diff = Math.abs(grads[i].value - value);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = grads[i];
      }
    }
    return closest.label;
  }

  /**
   * Retourne une icône emoji pour représenter le niveau de risque/difficulté
   */
  getLevelIcon(value: number): string {
    if (value <= 25) return '✓';
    if (value <= 50) return '◐';
    if (value <= 75) return '◉';
    return '⚠';
  }

  /**
   * Retourne la classe CSS de couleur de fond pour une valeur donnée
   */
  getValueBgClass(value: number): string {
    if (value <= 25) return 'bg-green-100';
    if (value <= 50) return 'bg-yellow-100';
    if (value <= 75) return 'bg-orange-100';
    return 'bg-red-100';
  }

  /**
   * Retourne la classe CSS de couleur de texte pour une valeur donnée
   */
  getValueTextClass(value: number): string {
    if (value <= 25) return 'text-green-700';
    if (value <= 50) return 'text-yellow-700';
    if (value <= 75) return 'text-orange-700';
    return 'text-red-700';
  }

  /**
   * Retourne la classe CSS pour la barre de progression
   */
  getProgressBarClass(value: number): string {
    if (value <= 25) return 'bg-green-500';
    if (value <= 50) return 'bg-yellow-500';
    if (value <= 75) return 'bg-orange-500';
    return 'bg-red-500';
  }

  /**
   * Toggle l'affichage des recommandations
   */
  toggleRecommendations(): void {
    this.showRecommendations = !this.showRecommendations;
  }

  /**
   * Retourne une description du niveau global avec suggestion spécifique
   */
  getOverallDescription(): string {
    const recommendations = this.recommendations;
    return recommendations.length > 0 ? recommendations[0].text : 'Estimation prête à être développée';
  }

  /**
   * Getter pour les recommandations avec cache
   */
  get recommendations(): Recommendation[] {
    return this.estimationService.getRecommendations(this.estimation);
  }

  /**
   * Retourne le nombre de recommandations à afficher dans le badge
   */
  get recommendationsCount(): number {
    return this.recommendations.length;
  }

  /**
   * Retourne true s'il y a des recommandations importantes (warning ou danger)
   */
  get hasImportantRecommendations(): boolean {
    return this.recommendations.some(r => r.type === 'warning' || r.type === 'danger');
  }

  /**
   * Retourne la couleur de la barre de progression globale
   */
  getOverallProgressClass(): string {
    const avg = this.getCurseAverage();
    return this.getProgressBarClass(avg);
  }

  /**
   * Retourne la classe CSS de la barre de progression basée sur la T-shirt size
   */
  getTShirtProgressClass(): string {
    const tshirt = this.getTShirtSize();
    // Convertir bg-xxx-100 en bg-xxx-500
    return tshirt.bgColor.replace('-100', '-500');
  }

  /**
   * Retourne un tableau pour générer les éléments array
   */
  createRange(count: number): number[] {
    return Array.from({ length: count }, (_, i) => i);
  }

  /**
   * Exporte le graphique au format JPG
   */
  async exportAsJpg(): Promise<void> {
    if (!this.exportContainer || this.isExporting) return;
    
    this.isExporting = true;
    
    try {
      const dataUrl = await htmlToImage.toJpeg(this.exportContainer.nativeElement, {
        backgroundColor: '#f1f5f9', // Fond clair (slate-100)
        pixelRatio: 2, // Meilleure qualité
        quality: 0.95
      });
      
      // Télécharger le fichier
      const link = document.createElement('a');
      const fileName = this.estimation?.name 
        ? `estimation-${this.estimation.name.replace(/[^a-zA-Z0-9]/g, '-')}.jpg`
        : 'estimation-radar.jpg';
      link.download = fileName;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Copie l'image du graphique dans le presse-papier
   */
  async copyToClipboard(): Promise<void> {
    if (!this.exportContainer || this.isExporting) return;
    
    this.isExporting = true;
    this.copySuccess = false;
    
    try {
      const blob = await htmlToImage.toBlob(this.exportContainer.nativeElement, {
        backgroundColor: '#f1f5f9', // Fond clair (slate-100)
        pixelRatio: 2 // Meilleure qualité
      });
      
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        this.copySuccess = true;
        // Reset le message de succès après 2 secondes
        setTimeout(() => {
          this.copySuccess = false;
        }, 2000);
      }
    } catch (error) {
      console.error('Erreur lors de la copie dans le presse-papier:', error);
    } finally {
      this.isExporting = false;
    }
  }
}
