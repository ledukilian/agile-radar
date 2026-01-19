import { Component, OnInit, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Estimation } from '../../models/estimation.model';
import { EstimationService } from '../../services/estimation.service';

@Component({
  selector: 'app-estimation-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './estimation-list.component.html',
  styleUrl: './estimation-list.component.scss'
})
export class EstimationListComponent implements OnInit {
  @Input() selectedId?: string;
  @Output() selectEstimation = new EventEmitter<Estimation | null>();
  @Output() newEstimationCreated = new EventEmitter<Estimation>();
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  estimations: Estimation[] = [];
  searchQuery: string = '';
  typeFilter: string = '';

  /**
   * Vérifie si une estimation correspond à la recherche
   */
  private matchesSearch(estimation: Estimation): boolean {
    if (!this.searchQuery.trim()) return true;
    const query = this.searchQuery.toLowerCase().trim();
    return estimation.name.toLowerCase().includes(query) ||
           (estimation.description?.toLowerCase().includes(query) ?? false);
  }

  /**
   * Retourne les estimations filtrées par la recherche et le type
   */
  get filteredEstimations(): Estimation[] {
    let result = this.estimations;

    // Filtrer par type
    if (this.typeFilter) {
      result = result.filter(estimation => estimation.type === this.typeFilter);
    }

    // Filtrer par recherche textuelle
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      result = result.filter(estimation =>
        estimation.name.toLowerCase().includes(query) ||
        estimation.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }

  /**
   * Retourne les features à afficher :
   * - Features qui correspondent à la recherche
   * - OU features dont au moins une US enfant correspond à la recherche
   */
  get features(): Estimation[] {
    const allFeatures = this.estimations.filter(e => e.type === 'feature');
    
    // Si pas de recherche, retourner toutes les features (filtrées par type si applicable)
    if (!this.searchQuery.trim()) {
      if (this.typeFilter) {
        return allFeatures.filter(f => f.type === this.typeFilter);
      }
      return allFeatures;
    }

    // Avec recherche : afficher la feature si elle match OU si une de ses US match
    return allFeatures.filter(feature => {
      // La feature elle-même correspond
      if (this.matchesSearch(feature)) return true;
      
      // Au moins une US enfant correspond
      const childUserStories = this.estimations.filter(e => 
        e.type === 'user-story' && e.parentFeatureId === feature.id
      );
      return childUserStories.some(us => this.matchesSearch(us));
    });
  }

  /**
   * Retourne les user stories enfants d'une feature donnée (filtrées par la recherche)
   */
  getChildUserStories(featureId: string): Estimation[] {
    const allChildren = this.estimations.filter(e => 
      e.type === 'user-story' && e.parentFeatureId === featureId
    );
    
    // Si pas de recherche, retourner toutes les US enfants
    if (!this.searchQuery.trim()) {
      return allChildren;
    }
    
    // Avec recherche, ne retourner que les US qui correspondent
    return allChildren.filter(us => this.matchesSearch(us));
  }

  /**
   * Retourne les user stories orphelines (sans parent feature, filtrées)
   */
  get orphanUserStories(): Estimation[] {
    const featureIds = this.estimations
      .filter(e => e.type === 'feature')
      .map(e => e.id);
    
    return this.filteredEstimations.filter(e => 
      e.type === 'user-story' && (!e.parentFeatureId || !featureIds.includes(e.parentFeatureId))
    );
  }

  /**
   * Retourne TOUTES les user stories enfants d'une feature (sans filtre de recherche)
   * Utilisé pour le calcul des points totaux
   */
  getAllChildUserStories(featureId: string): Estimation[] {
    return this.estimations.filter(e => 
      e.type === 'user-story' && e.parentFeatureId === featureId
    );
  }

  /**
   * Calcule le total des points pour une feature selon son mode de calcul
   */
  getFeatureTotalPoints(feature: Estimation): number {
    const mode = feature.complexityMode || 'feature-only';
    
    if (mode === 'sum-us') {
      // Somme des US uniquement (toutes les US, pas seulement celles filtrées)
      // On arrondit au ceil chaque US avant de sommer pour être cohérent avec l'affichage
      return this.getAllChildUserStories(feature.id)
        .reduce((sum, us) => sum + this.getComplexityPointsCeil(us), 0);
    } else {
      // Uniquement la feature
      return Math.ceil(this.calculateComplexityPoints(feature));
    }
  }

  /**
   * Vérifie si la liste groupée a des éléments à afficher
   */
  get hasGroupedItems(): boolean {
    return this.features.length > 0 || this.orphanUserStories.length > 0;
  }

  // État d'expansion des features
  expandedFeatures: Set<string> = new Set();

  toggleFeatureExpand(featureId: string): void {
    if (this.expandedFeatures.has(featureId)) {
      this.expandedFeatures.delete(featureId);
    } else {
      this.expandedFeatures.add(featureId);
    }
  }

  isFeatureExpanded(featureId: string): boolean {
    return this.expandedFeatures.has(featureId);
  }

  // T-shirt sizes avec leurs ranges de points de complexité (progression Fibonacci)
  tShirtSizes = [
    { size: 'XS', min: 1, max: 3, bgColor: 'bg-green-100', textColor: 'text-green-700' },
    { size: 'S', min: 3, max: 8, bgColor: 'bg-lime-100', textColor: 'text-lime-700' },
    { size: 'M', min: 8, max: 21, bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
    { size: 'L', min: 21, max: 55, bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
    { size: 'XL', min: 55, max: 144, bgColor: 'bg-red-100', textColor: 'text-red-700' },
    { size: 'XXL', min: 144, max: 377, bgColor: 'bg-purple-100', textColor: 'text-purple-700' }
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

  constructor(private estimationService: EstimationService) {}

  ngOnInit(): void {
    this.loadEstimations();
    this.estimationService.estimations$.subscribe(estimations => {
      this.estimations = estimations;
    });
  }

  loadEstimations(): void {
    this.estimations = this.estimationService.getAllEstimations();
  }

  onSelect(estimation: Estimation): void {
    // Si l'estimation est déjà sélectionnée, la désélectionner
    if (this.selectedId === estimation.id) {
      this.selectEstimation.emit(null);
    } else {
      this.selectEstimation.emit(estimation);
    }
  }

  onNewEstimation(): void {
    // Créer une nouvelle estimation avec des valeurs au minimum (0)
    const newEstimation = this.estimationService.createEstimation({
      name: 'Nouvelle estimation',
      description: '',
      type: 'user-story',
      complexity: 0,
      uncertainty: 0,
      risk: 0,
      size: 0,
      effort: 0
    });
    // Émettre l'événement de création (différent de la sélection)
    // Cela permettra d'ouvrir directement le mode édition
    this.newEstimationCreated.emit(newEstimation);
  }

  /**
   * Calcule les points de complexité pour une estimation donnée
   */
  calculateComplexityPoints(estimation: Estimation): number {
    // Utiliser directement les valeurs numériques (système analogique)
    const curseAverage = (
      estimation.complexity +
      estimation.uncertainty +
      estimation.risk +
      estimation.size +
      estimation.effort
    ) / 5;

    const normalized = curseAverage / 100;
    const points = Math.pow(377, normalized);
    return Math.round(points * 10) / 10;
  }

  /**
   * Retourne les points de complexité arrondis au supérieur
   */
  getComplexityPointsCeil(estimation: Estimation): number {
    return Math.ceil(this.calculateComplexityPoints(estimation));
  }

  /**
   * Détermine la T-shirt size pour un nombre de points donné
   * Utilise <= pour que la borne max soit incluse dans la taille (ex: 8 pts = S, pas M)
   */
  private getTShirtSizeByPoints(points: number): { size: string; min: number; max: number; bgColor: string; textColor: string } {
    for (const tShirt of this.tShirtSizes) {
      if (points <= tShirt.max) {
        return tShirt;
      }
    }
    return this.tShirtSizes[this.tShirtSizes.length - 1];
  }

  /**
   * Détermine la T-shirt size pour une estimation donnée
   * Utilise les points arrondis au ceil pour être cohérent avec l'affichage
   */
  getTShirtSize(estimation: Estimation): { size: string; min: number; max: number; bgColor: string; textColor: string } {
    const points = this.getComplexityPointsCeil(estimation);
    return this.getTShirtSizeByPoints(points);
  }

  /**
   * Détermine la T-shirt size pour une feature en tenant compte du mode de calcul
   * En mode "sum-us", la couleur est basée sur la somme des US, pas sur les valeurs de la feature
   */
  getFeatureTShirtSize(feature: Estimation): { size: string; min: number; max: number; bgColor: string; textColor: string } {
    const points = this.getFeatureTotalPoints(feature);
    return this.getTShirtSizeByPoints(points);
  }

  /**
   * Formate une date au format dd/mm/yyyy à hh:mm
   */
  formatDate(date: Date): string {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} à ${hours}:${minutes}`;
  }

  /**
   * Exporte les estimations en JSON
   */
  onExport(): void {
    this.estimationService.downloadAsJson();
  }

  /**
   * Ouvre le sélecteur de fichier pour l'import
   */
  onImportClick(): void {
    this.fileInput.nativeElement.click();
  }

  /**
   * Gère l'import du fichier sélectionné
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = reader.result as string;
        const result = this.estimationService.importFromJson(content);
        
        const messages: string[] = [];
        if (result.added > 0) {
          messages.push(`${result.added} ajoutée(s)`);
        }
        if (result.updated > 0) {
          messages.push(`${result.updated} mise(s) à jour`);
        }
        
        if (messages.length > 0) {
          alert(`Import réussi : ${messages.join(', ')}`);
        } else {
          alert('Aucune estimation à importer.');
        }
      } catch (error) {
        alert('Erreur lors de l\'import du fichier. Vérifiez que le format est correct.');
      }
      // Reset input pour permettre de réimporter le même fichier
      input.value = '';
    };
    reader.readAsText(file);
  }

  /**
   * Supprime toutes les estimations après confirmation
   */
  onDeleteAll(): void {
    const count = this.estimations.length;
    if (count === 0) return;
    
    if (confirm(`Êtes-vous sûr de vouloir supprimer toutes vos données ?\n\nCette action supprimera ${count} estimation(s) et est irréversible.`)) {
      this.estimationService.deleteAllEstimations();
      this.selectEstimation.emit(null); // Désélectionner l'estimation courante
    }
  }
}
