import { Component, OnInit, OnChanges, Input, ViewChild, ElementRef, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartData, registerables } from 'chart.js';
import { Estimation } from '../../models/estimation.model';
import { SettingsService } from '../../services/settings.service';
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
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('exportContainer', { static: true }) exportContainer!: ElementRef<HTMLDivElement>;
  
  private chart?: Chart;
  isExporting = false;
  copySuccess = false;

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
      { label: 'Moyenne', value: 50 },
      { label: 'Complexe', value: 75 },
      { label: 'Impossible', value: 100 }
    ],
    uncertainty: [
      { label: 'Aucune', value: 0 },
      { label: 'Faible', value: 25 },
      { label: 'Moyenne', value: 50 },
      { label: 'Élevée', value: 75 },
      { label: 'Totale', value: 100 }
    ],
    risk: [
      { label: 'Aucun', value: 0 },
      { label: 'Faible', value: 33 },
      { label: 'Moyen', value: 66 },
      { label: 'Élevé', value: 100 }
    ],
    size: [
      { label: 'Petit', value: 0 },
      { label: 'Moyen', value: 33 },
      { label: 'Grand', value: 66 },
      { label: 'Énorme', value: 100 }
    ],
    effort: [
      { label: 'Petit', value: 0 },
      { label: 'Moyen', value: 33 },
      { label: 'Grand', value: 66 },
      { label: 'Inconnu', value: 100 }
    ]
  };

  constructor(private settingsService: SettingsService) {}

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
            ticks: {
              stepSize: 20,
              display: false
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            },
            pointLabels: {
              font: {
                size: 14,
                weight: 'bold'
              },
              color: '#374151'
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

    // Graduations spécifiques pour chaque axe CURSE (en français - synchronisé avec le formulaire)
    const graduations = {
      complexity: [
        { label: 'Aucune', value: 0 },
        { label: 'Simple', value: 25 },
        { label: 'Moyenne', value: 50 },
        { label: 'Complexe', value: 75 },
        { label: 'Impossible', value: 100 }
      ],
      uncertainty: [
        { label: 'Aucune', value: 0 },
        { label: 'Faible', value: 25 },
        { label: 'Moyenne', value: 50 },
        { label: 'Élevée', value: 75 },
        { label: 'Totale', value: 100 }
      ],
      risk: [
        { label: 'Aucun', value: 0 },
        { label: 'Faible', value: 33 },
        { label: 'Moyen', value: 66 },
        { label: 'Élevé', value: 100 }
      ],
      size: [
        { label: 'Petit', value: 0 },
        { label: 'Moyen', value: 33 },
        { label: 'Grand', value: 66 },
        { label: 'Énorme', value: 100 }
      ],
      effort: [
        { label: 'Petit', value: 0 },
        { label: 'Moyen', value: 33 },
        { label: 'Grand', value: 66 },
        { label: 'Inconnu', value: 100 }
      ]
    };

    const getValue = (label: string, axis: keyof typeof graduations): number => {
      const grads = graduations[axis];
      const grad = grads.find(g => g.label.toLowerCase() === label.toLowerCase());
      return grad?.value || 0;
    };

    // Obtenir la couleur basée sur la T-shirt size
    const tShirt = this.getTShirtSize();

    return {
      labels: ['Complexité', 'Incertitude', 'Risque', 'Taille', 'Effort'],
      datasets: [
        {
          label: this.estimation.name,
          data: [
            getValue(this.estimation.complexity, 'complexity'),
            getValue(this.estimation.uncertainty, 'uncertainty'),
            getValue(this.estimation.risk, 'risk'),
            getValue(this.estimation.size, 'size'),
            getValue(this.estimation.effort, 'effort')
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
    if (!this.estimation) return 50;
    
    const getValue = (label: string, axis: keyof typeof this.graduations): number => {
      const grads = this.graduations[axis];
      const grad = grads.find(g => g.label.toLowerCase() === label.toLowerCase());
      return grad?.value || 50;
    };

    return (
      getValue(this.estimation.complexity, 'complexity') +
      getValue(this.estimation.uncertainty, 'uncertainty') +
      getValue(this.estimation.risk, 'risk') +
      getValue(this.estimation.size, 'size') +
      getValue(this.estimation.effort, 'effort')
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
    const label = this.estimation[dimension];
    const grads = this.graduations[dimension];
    const grad = grads.find(g => g.label.toLowerCase() === label.toLowerCase());
    return grad?.value || 0;
  }

  /**
   * Retourne l'index de graduation pour une dimension (pour afficher les niveaux)
   */
  getGraduationIndex(dimension: 'complexity' | 'uncertainty' | 'risk' | 'size' | 'effort'): number {
    if (!this.estimation) return 0;
    const label = this.estimation[dimension];
    const grads = this.graduations[dimension];
    return grads.findIndex(g => g.label.toLowerCase() === label.toLowerCase());
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
   * Retourne une description du niveau global avec suggestion spécifique
   */
  getOverallDescription(): string {
    if (!this.estimation) return '';
    
    const size = this.getValueForDimension('size');
    const complexity = this.getValueForDimension('complexity');
    const uncertainty = this.getValueForDimension('uncertainty');
    const risk = this.getValueForDimension('risk');
    const effort = this.getValueForDimension('effort');
    
    // Trouver le facteur le plus problématique
    const factors = [
      { name: 'size', value: size },
      { name: 'complexity', value: complexity },
      { name: 'uncertainty', value: uncertainty },
      { name: 'risk', value: risk },
      { name: 'effort', value: effort }
    ];
    
    const maxFactor = factors.reduce((a, b) => a.value > b.value ? a : b);
    
    // Si tout est bas, message positif
    if (maxFactor.value <= 33) {
      return 'Estimation bien maîtrisée - Prête à être développée';
    }
    
    // Suggestions spécifiques selon le facteur dominant
    if (maxFactor.name === 'size' && size >= 66) {
      return size >= 100 
        ? 'Taille énorme → Diviser en plusieurs user stories plus petites ?'
        : 'Grande taille → Découper en sous-tâches ?';
    }
    
    if (maxFactor.name === 'complexity' && complexity >= 75) {
      return complexity >= 100
        ? 'Complexité très élevée → Organiser une clarification technique ?'
        : 'Haute complexité → Prévoir un spike technique ?';
    }
    
    if (maxFactor.name === 'uncertainty' && uncertainty >= 50) {
      if (uncertainty >= 100) return 'Incertitude totale → Clarifier les besoins avec le PO ?';
      if (uncertainty >= 75) return 'Forte incertitude → Réaliser un POC préalable ?';
      return 'Incertitude moyenne → Valider les hypothèses ?';
    }
    
    if (maxFactor.name === 'risk' && risk >= 66) {
      return risk >= 100
        ? 'Risque élevé → Définir un plan de mitigation ?'
        : 'Risque moyen → Identifier les scénarios de fallback ?';
    }
    
    if (maxFactor.name === 'effort' && effort >= 66) {
      return effort >= 100
        ? 'Effort inconnu → Analyse approfondie nécessaire ?'
        : 'Effort important → Envisager le pair programming ?';
    }
    
    // Fallback basé sur la moyenne
    const avg = this.getCurseAverage();
    if (avg <= 40) return 'Estimation accessible - Complexité maîtrisable';
    if (avg <= 60) return 'Estimation modérée - Attention aux dépendances';
    return 'Estimation complexe - Prévoir du temps supplémentaire';
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
