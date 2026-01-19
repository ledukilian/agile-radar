import { Component, OnInit, OnChanges, Input, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Estimation, Taille } from '../../models/estimation.model';
import { SettingsService } from '../../services/settings.service';
import { EstimationService, Recommendation } from '../../services/estimation.service';

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
  @Output() closeForm = new EventEmitter<void>();

  // Onglet actif
  activeTab: 'base' | 'curseurs' | 'conseils' | 'json' = 'base';
  
  // Recommandations calculées (stockées pour éviter les recalculs dans le template)
  recommendations: Recommendation[] = [];

  // Éditeur JSON (mode avancé)
  showJsonEditor: boolean = false;
  jsonEditorContent: string = '';
  jsonError: string | null = null;
  jsonCopied: boolean = false;

  // Limites de caractères pour les champs
  readonly charLimits = {
    name: 80,
    description: 250,
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
  
  formData: {
    name: string;
    description: string;
    date: string;
    author: string;
    type: 'user-story' | 'feature';
    parentFeatureId: string;
    complexityMode: 'feature-only' | 'sum-us';
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
    type: 'user-story',
    parentFeatureId: '',
    complexityMode: 'feature-only',
    complexity: 50,
    uncertainty: 50,
    risk: 50,
    size: 50,
    effort: 50
  };

  // Liste des features disponibles pour lier une user story
  availableFeatures: Estimation[] = [];

  constructor(
    private settingsService: SettingsService,
    private estimationService: EstimationService
  ) {}

  ngOnInit(): void {
    this.loadTailles();
    this.loadAvailableFeatures();
    this.initializeForm();
    this.updateRecommendations();
    // Émettre immédiatement une estimation temporaire pour l'affichage live
    // Utiliser setTimeout pour s'assurer que les tailles sont chargées
    setTimeout(() => {
      this.emitTemporaryEstimation();
    }, 0);
  }

  private loadAvailableFeatures(): void {
    this.availableFeatures = this.estimationService.getFeatures();
    // S'abonner aux changements pour mettre à jour la liste
    this.estimationService.estimations$.subscribe(() => {
      this.availableFeatures = this.estimationService.getFeatures();
    });
  }

  /**
   * Retourne les user stories enfants de la feature courante
   */
  getChildUserStories(): Estimation[] {
    if (!this.estimation || this.formData.type !== 'feature') {
      return [];
    }
    return this.estimationService.getUserStoriesForFeature(this.estimation.id);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['estimation']) {
      const prev = changes['estimation'].previousValue;
      const curr = changes['estimation'].currentValue;
      
      // Ne réinitialiser que si l'ID a changé (nouvelle estimation sélectionnée)
      // Évite la boucle infinie quand on met à jour les valeurs
      if (prev?.id !== curr?.id) {
        this.initializeForm();
        this.updateRecommendations();
        // Émettre immédiatement après l'initialisation pour mise à jour live
        this.emitTemporaryEstimation();
      }
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
      
      // Utiliser directement les valeurs numériques de l'estimation
      this.formData = {
        name: this.estimation.name,
        description: this.estimation.description || '',
        date: defaultDate,
        author: this.estimation.author || defaultAuthor,
        type: this.estimation.type || 'user-story',
        parentFeatureId: this.estimation.parentFeatureId || '',
        complexityMode: this.estimation.complexityMode || 'feature-only',
        complexity: this.estimation.complexity,
        uncertainty: this.estimation.uncertainty,
        risk: this.estimation.risk,
        size: this.estimation.size,
        effort: this.estimation.effort
      };
    } else {
      // Nouvelle estimation : valeurs par défaut au minimum (0)
      this.formData = {
        name: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        author: defaultAuthor,
        type: 'user-story',
        parentFeatureId: '',
        complexityMode: 'feature-only',
        complexity: 0,
        uncertainty: 0,
        risk: 0,
        size: 0,
        effort: 0
      };
    }
    
    // Mettre à jour le contenu JSON
    this.updateJsonEditorContent();
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

  /**
   * Vérifie si l'onglet Évaluation doit être désactivé
   * (quand une feature est en mode "Somme des US")
   */
  get isEvaluationTabDisabled(): boolean {
    return this.formData.type === 'feature' && this.formData.complexityMode === 'sum-us';
  }

  setActiveTab(tab: 'base' | 'curseurs' | 'conseils' | 'json'): void {
    // Empêcher l'accès à l'onglet curseurs si désactivé
    if (tab === 'curseurs' && this.isEvaluationTabDisabled) {
      return;
    }
    this.activeTab = tab;
    // Si on ouvre l'onglet JSON, s'assurer que le contenu est à jour
    if (tab === 'json') {
      this.updateJsonEditorContent();
    }
  }

  onFieldChange(): void {
    // Forcer la conversion en nombre pour les valeurs des sliders
    // (les inputs range retournent des strings avec ngModel)
    this.formData.complexity = +this.formData.complexity;
    this.formData.uncertainty = +this.formData.uncertainty;
    this.formData.risk = +this.formData.risk;
    this.formData.size = +this.formData.size;
    this.formData.effort = +this.formData.effort;

    // Si on passe en mode "sum-us" et qu'on est sur l'onglet curseurs, basculer vers l'onglet base
    if (this.isEvaluationTabDisabled && this.activeTab === 'curseurs') {
      this.activeTab = 'base';
    }

    // Mettre à jour les recommandations
    this.updateRecommendations();
    
    // Synchroniser l'éditeur JSON si visible
    if (this.showJsonEditor) {
      this.updateJsonEditorContent();
    }

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
    // Utiliser directement les valeurs numériques (système analogique)
    const tempEstimation: Estimation = {
      id: this.estimation?.id || 'temp',
      uuid: this.estimation?.uuid || 'temp-uuid',
      name: this.formData.name.trim() || 'Nouvelle estimation',
      description: this.formData.description,
      date: this.formData.date,
      author: this.formData.author,
      type: this.formData.type,
      parentFeatureId: this.formData.parentFeatureId || undefined,
      complexityMode: this.formData.type === 'feature' ? this.formData.complexityMode : undefined,
      complexity: this.formData.complexity,
      uncertainty: this.formData.uncertainty,
      risk: this.formData.risk,
      size: this.formData.size,
      effort: this.formData.effort,
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

    // Sauvegarder directement les valeurs numériques (système analogique)
    const data = {
      name: this.formData.name,
      description: this.formData.description,
      date: this.formData.date,
      author: this.formData.author,
      type: this.formData.type,
      parentFeatureId: this.formData.parentFeatureId || undefined,
      complexityMode: this.formData.type === 'feature' ? this.formData.complexityMode : undefined,
      complexity: this.formData.complexity,
      uncertainty: this.formData.uncertainty,
      risk: this.formData.risk,
      size: this.formData.size,
      effort: this.formData.effort
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
      type: 'user-story',
      parentFeatureId: '',
      complexityMode: 'feature-only',
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
    return this.calculatePointsFromAverage(curseAverage);
  }

  /**
   * Calcule les points de complexité pour une estimation donnée
   */
  calculatePointsForEstimation(estimation: Estimation): number {
    const avg = (estimation.complexity + estimation.uncertainty + estimation.risk + estimation.size + estimation.effort) / 5;
    return this.calculatePointsFromAverage(avg);
  }

  /**
   * Calcule les points à partir d'une moyenne CURSE
   */
  private calculatePointsFromAverage(curseAverage: number): number {
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

  /**
   * Met à jour les recommandations basées sur les valeurs actuelles du formulaire
   */
  private updateRecommendations(): void {
    // Créer une estimation temporaire à partir des valeurs du formulaire
    const tempEstimation: Estimation = {
      id: this.estimation?.id || 'temp',
      uuid: this.estimation?.uuid || 'temp-uuid',
      name: this.formData.name,
      description: this.formData.description,
      date: this.formData.date,
      author: this.formData.author,
      type: this.formData.type,
      parentFeatureId: this.formData.parentFeatureId || undefined,
      complexity: this.formData.complexity,
      uncertainty: this.formData.uncertainty,
      risk: this.formData.risk,
      size: this.formData.size,
      effort: this.formData.effort,
      createdAt: this.estimation?.createdAt || new Date(),
      updatedAt: new Date()
    };
    this.recommendations = this.estimationService.getRecommendations(tempEstimation);
  }

  /**
   * Toggle l'affichage de l'éditeur JSON
   */
  toggleJsonEditor(): void {
    this.showJsonEditor = !this.showJsonEditor;
    if (this.showJsonEditor) {
      this.updateJsonEditorContent();
    }
  }

  /**
   * Met à jour le contenu JSON à partir des données du formulaire
   */
  private updateJsonEditorContent(): void {
    const jsonData: Record<string, any> = {
      name: this.formData.name,
      description: this.formData.description,
      date: this.formData.date,
      author: this.formData.author,
      type: this.formData.type,
      complexity: this.formData.complexity,
      uncertainty: this.formData.uncertainty,
      risk: this.formData.risk,
      size: this.formData.size,
      effort: this.formData.effort
    };
    // Ajouter parentFeatureId seulement pour les user stories
    if (this.formData.type === 'user-story' && this.formData.parentFeatureId) {
      jsonData['parentFeatureId'] = this.formData.parentFeatureId;
    }
    // Ajouter complexityMode seulement pour les features
    if (this.formData.type === 'feature') {
      jsonData['complexityMode'] = this.formData.complexityMode;
    }
    this.jsonEditorContent = JSON.stringify(jsonData, null, 2);
    this.jsonError = null;
  }

  /**
   * Appelé quand le contenu JSON est modifié manuellement
   */
  onJsonChange(): void {
    try {
      const parsed = JSON.parse(this.jsonEditorContent);
      this.jsonError = null;
      
      // Valider et appliquer les valeurs
      if (typeof parsed.name === 'string') {
        this.formData.name = parsed.name.substring(0, this.charLimits.name);
      }
      if (typeof parsed.description === 'string') {
        this.formData.description = parsed.description.substring(0, this.charLimits.description);
      }
      if (typeof parsed.date === 'string') {
        this.formData.date = parsed.date;
      }
      if (typeof parsed.author === 'string') {
        this.formData.author = parsed.author.substring(0, this.charLimits.author);
      }
      if (parsed.type === 'user-story' || parsed.type === 'feature') {
        this.formData.type = parsed.type;
      }
      if (typeof parsed.parentFeatureId === 'string') {
        this.formData.parentFeatureId = parsed.parentFeatureId;
      }
      if (parsed.complexityMode === 'feature-only' || parsed.complexityMode === 'sum-us') {
        this.formData.complexityMode = parsed.complexityMode;
      }
      
      // Valider les valeurs numériques (0-100)
      const numericFields = ['complexity', 'uncertainty', 'risk', 'size', 'effort'] as const;
      for (const field of numericFields) {
        if (typeof parsed[field] === 'number') {
          this.formData[field] = Math.max(0, Math.min(100, parsed[field]));
        }
      }
      
      // Déclencher la mise à jour
      this.updateRecommendations();
      this.emitTemporaryEstimation();
      
      // Debounce pour la sauvegarde
      if (this.formData.name.trim()) {
        if (this.saveTimeout) {
          clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
          this.saveEstimation();
        }, 500);
      }
    } catch (e) {
      this.jsonError = 'JSON invalide';
    }
  }

  /**
   * Copie le contenu JSON dans le presse-papier
   */
  async copyJson(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.jsonEditorContent);
      this.jsonCopied = true;
      setTimeout(() => {
        this.jsonCopied = false;
      }, 2000);
    } catch (e) {
      // Fallback pour les navigateurs qui ne supportent pas l'API clipboard
      console.error('Impossible de copier dans le presse-papier', e);
    }
  }

  /**
   * Colle le contenu du presse-papier dans l'éditeur JSON
   */
  async pasteJson(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      this.jsonEditorContent = text;
      this.onJsonChange();
    } catch (e) {
      // Fallback pour les navigateurs qui ne supportent pas l'API clipboard
      console.error('Impossible de lire le presse-papier', e);
    }
  }
}
