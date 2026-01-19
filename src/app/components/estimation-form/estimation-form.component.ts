import { Component, OnInit, OnChanges, Input, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Estimation, Taille } from '../../models/estimation.model';
import { SettingsService } from '../../services/settings.service';
import { EstimationService } from '../../services/estimation.service';

@Component({
  selector: 'app-estimation-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './estimation-form.component.html',
  styleUrl: './estimation-form.component.scss'
})
export class EstimationFormComponent implements OnInit, OnChanges {
  @Input() estimation?: Estimation;
  @Input() compact: boolean = false;
  @Output() estimationChanged = new EventEmitter<Estimation | null>();
  @Output() deleteEstimation = new EventEmitter<string>();

  // Onglet actif
  activeTab: 'base' | 'curseurs' = 'base';

  // Limites de caractères pour les champs
  readonly charLimits = {
    name: 80,
    description: 200,
    author: 50
  };

  // Clé localStorage pour l'auteur par défaut
  private readonly AUTHOR_STORAGE_KEY = 'agile-radar-default-author';

  tailles: Taille[] = [];
  private saveTimeout?: ReturnType<typeof setTimeout>;
  
  // T-shirt sizes avec leurs ranges de points de complexité (progression Fibonacci)
  tShirtSizes = [
    { size: 'XS', min: 1, max: 3, color: 'bg-green-100 text-green-700' },
    { size: 'S', min: 3, max: 8, color: 'bg-lime-100 text-lime-700' },
    { size: 'M', min: 8, max: 21, color: 'bg-yellow-100 text-yellow-700' },
    { size: 'L', min: 21, max: 55, color: 'bg-orange-100 text-orange-700' },
    { size: 'XL', min: 55, max: 144, color: 'bg-red-100 text-red-700' },
    { size: 'XXL', min: 144, max: 377, color: 'bg-purple-100 text-purple-700' }
  ];
  
  // Graduations spécifiques pour chaque axe CURSE (en français)
  graduations = {
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
  
  formData: {
    name: string;
    description: string;
    date: string;
    author: string;
    complexity: number; // Valeur continue 0-100
    uncertainty: number;
    risk: number;
    size: number;
    effort: number;
  } = {
    name: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    author: '',
    complexity: 50,
    uncertainty: 50,
    risk: 50,
    size: 50,
    effort: 50
  };

  constructor(
    private settingsService: SettingsService,
    private estimationService: EstimationService
  ) {}

  ngOnInit(): void {
    this.loadTailles();
    this.initializeForm();
    // Émettre immédiatement une estimation temporaire pour l'affichage live
    // Utiliser setTimeout pour s'assurer que les tailles sont chargées
    setTimeout(() => {
      this.emitTemporaryEstimation();
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['estimation']) {
      this.initializeForm();
      // Émettre immédiatement après l'initialisation pour mise à jour live
      this.emitTemporaryEstimation();
    }
  }

  private loadTailles(): void {
    this.tailles = this.settingsService.getTailles();
    this.settingsService.config$.subscribe(() => {
      this.tailles = this.settingsService.getTailles();
      this.initializeForm();
      // Émettre immédiatement après mise à jour des tailles
      this.emitTemporaryEstimation();
    });
  }

  private initializeForm(): void {
    const defaultAuthor = this.getDefaultAuthor();
    
    if (this.estimation) {
      // Date par défaut = date enregistrée ou date de dernière modification
      const defaultDate = this.estimation.date || this.formatDateToInput(this.estimation.updatedAt);
      
      this.formData = {
        name: this.estimation.name,
        description: this.estimation.description || '',
        date: defaultDate,
        author: this.estimation.author || defaultAuthor,
        complexity: this.getGraduationValue(this.estimation.complexity, 'complexity'),
        uncertainty: this.getGraduationValue(this.estimation.uncertainty, 'uncertainty'),
        risk: this.getGraduationValue(this.estimation.risk, 'risk'),
        size: this.getGraduationValue(this.estimation.size, 'size'),
        effort: this.getGraduationValue(this.estimation.effort, 'effort')
      };
    } else {
      // Nouvelle estimation : valeurs par défaut au minimum (0)
      this.formData = {
        name: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        author: defaultAuthor,
        complexity: 0,
        uncertainty: 0,
        risk: 0,
        size: 0,
        effort: 0
      };
    }
  }

  private formatDateToInput(date: Date): string {
    if (!date) return new Date().toISOString().split('T')[0];
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  private getDefaultAuthor(): string {
    try {
      return localStorage.getItem(this.AUTHOR_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }

  private saveDefaultAuthor(author: string): void {
    try {
      if (author.trim()) {
        localStorage.setItem(this.AUTHOR_STORAGE_KEY, author.trim());
      }
    } catch {
      // Ignorer les erreurs de localStorage
    }
  }

  private getGraduationValue(label: string, axis: 'complexity' | 'uncertainty' | 'risk' | 'size' | 'effort'): number {
    const graduations = this.graduations[axis];
    const graduation = graduations.find(g => g.label.toLowerCase() === label.toLowerCase());
    return graduation?.value || 50; // Valeur par défaut au milieu
  }

  private getTailleLabel(value: number, axis: 'complexity' | 'uncertainty' | 'risk' | 'size' | 'effort'): string {
    const graduations = this.graduations[axis];
    if (graduations.length === 0) {
      return 'M';
    }
    // Trouver la graduation la plus proche de la valeur
    const closest = graduations.reduce((prev, curr) => 
      Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev
    );
    return closest.label;
  }

  getGraduationForValue(value: number, axis: 'complexity' | 'uncertainty' | 'risk' | 'size' | 'effort'): { label: string; value: number } | undefined {
    const graduations = this.graduations[axis];
    if (graduations.length === 0) {
      return undefined;
    }
    // Trouver la graduation la plus proche de la valeur
    return graduations.reduce((prev, curr) => 
      Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev
    );
  }

  getGraduations(axis: 'complexity' | 'uncertainty' | 'risk' | 'size' | 'effort'): { label: string; value: number }[] {
    return this.graduations[axis] || [];
  }

  setActiveTab(tab: 'base' | 'curseurs'): void {
    this.activeTab = tab;
  }

  onFieldChange(): void {
    // Émettre une estimation temporaire pour mise à jour live du graphique
    this.emitTemporaryEstimation();

    if (!this.formData.name.trim()) {
      return; // Ne pas sauvegarder si le nom est vide
    }

    // Debounce pour éviter trop de sauvegardes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveEstimation();
    }, 500);
  }

  private emitTemporaryEstimation(): void {
    // Permettre l'affichage même sans nom pour le live update
    // Utiliser directement la valeur pour le graphique, mais convertir en label pour l'affichage
    const tempEstimation: Estimation = {
      id: this.estimation?.id || 'temp',
      uuid: this.estimation?.uuid || 'temp-uuid',
      name: this.formData.name.trim() || 'Nouvelle estimation',
      description: this.formData.description,
      date: this.formData.date,
      author: this.formData.author,
      complexity: this.getTailleLabel(this.formData.complexity, 'complexity'),
      uncertainty: this.getTailleLabel(this.formData.uncertainty, 'uncertainty'),
      risk: this.getTailleLabel(this.formData.risk, 'risk'),
      size: this.getTailleLabel(this.formData.size, 'size'),
      effort: this.getTailleLabel(this.formData.effort, 'effort'),
      createdAt: this.estimation?.createdAt || new Date(),
      updatedAt: new Date()
    };

    this.estimationChanged.emit(tempEstimation);
  }

  private saveEstimation(): void {
    if (!this.formData.name.trim()) {
      return;
    }

    // Sauvegarder l'auteur par défaut si renseigné
    if (this.formData.author.trim()) {
      this.saveDefaultAuthor(this.formData.author);
    }

    const data = {
      name: this.formData.name,
      description: this.formData.description,
      date: this.formData.date,
      author: this.formData.author,
      complexity: this.getTailleLabel(this.formData.complexity, 'complexity'),
      uncertainty: this.getTailleLabel(this.formData.uncertainty, 'uncertainty'),
      risk: this.getTailleLabel(this.formData.risk, 'risk'),
      size: this.getTailleLabel(this.formData.size, 'size'),
      effort: this.getTailleLabel(this.formData.effort, 'effort')
    };

    if (this.estimation) {
      const updated = this.estimationService.updateEstimation(this.estimation.id, data);
      if (updated) {
        this.estimationChanged.emit(updated);
      }
    } else {
      // Créer une nouvelle estimation
      const newEstimation = this.estimationService.createEstimation(data);
      this.estimationChanged.emit(newEstimation);
    }
  }

  createNew(): void {
    this.formData = {
      name: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      author: this.getDefaultAuthor(),
      complexity: 0,
      uncertainty: 0,
      risk: 0,
      size: 0,
      effort: 0
    };
    // Émettre immédiatement une estimation temporaire pour l'affichage live
    this.emitTemporaryEstimation();
  }

  /**
   * Calcule la moyenne CURSE (0-100) à partir des 5 axes
   */
  getCurseAverage(): number {
    return (
      this.formData.complexity +
      this.formData.uncertainty +
      this.formData.risk +
      this.formData.size +
      this.formData.effort
    ) / 5;
  }

  /**
   * Calcule les points de complexité à partir du score CURSE moyen (0-100)
   * Utilise une formule exponentielle pour suivre la progression Fibonacci
   * Score 0 → 1 point, Score 100 → 377 points
   */
  calculateComplexityPoints(): number {
    const curseAverage = this.getCurseAverage();
    // Normaliser entre 0 et 1
    const normalized = curseAverage / 100;
    // Formule exponentielle: 377^x donne une progression naturelle vers Fibonacci
    // Minimum 1 point, maximum 377 points
    const points = Math.pow(377, normalized);
    return Math.round(points * 10) / 10; // Arrondir à 1 décimale
  }

  /**
   * Détermine la T-shirt size en fonction des points de complexité
   */
  getTShirtSize(): { size: string; min: number; max: number; color: string } {
    const points = this.calculateComplexityPoints();
    
    // Trouver la taille correspondante
    for (const tShirt of this.tShirtSizes) {
      if (points < tShirt.max) {
        return tShirt;
      }
    }
    // Si au-delà de tout (ne devrait pas arriver), retourner XXL
    return this.tShirtSizes[this.tShirtSizes.length - 1];
  }

  /**
   * Retourne la progression dans la T-shirt size actuelle (0-100%)
   */
  getTShirtProgress(): number {
    const points = this.calculateComplexityPoints();
    const tShirt = this.getTShirtSize();
    const range = tShirt.max - tShirt.min;
    const position = points - tShirt.min;
    return Math.min(100, Math.max(0, (position / range) * 100));
  }

  /**
   * Supprime l'estimation courante
   */
  onDelete(): void {
    if (this.estimation && confirm(`Êtes-vous sûr de vouloir supprimer "${this.estimation.name}" ?`)) {
      this.deleteEstimation.emit(this.estimation.id);
    }
  }
}
