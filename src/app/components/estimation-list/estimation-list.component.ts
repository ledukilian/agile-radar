import { Component, OnInit, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Estimation } from '../../models/estimation.model';
import { EstimationService } from '../../services/estimation.service';

@Component({
  selector: 'app-estimation-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './estimation-list.component.html',
  styleUrl: './estimation-list.component.scss'
})
export class EstimationListComponent implements OnInit {
  @Input() selectedId?: string;
  @Output() selectEstimation = new EventEmitter<Estimation | null>();
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  estimations: Estimation[] = [];

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
    // Créer une nouvelle estimation avec des valeurs au minimum
    const newEstimation = this.estimationService.createEstimation({
      name: 'Nouvelle estimation',
      description: '',
      complexity: 'Aucune',
      uncertainty: 'Aucune',
      risk: 'Aucun',
      size: 'Petit',
      effort: 'Petit'
    });
    // Sélectionner automatiquement la nouvelle estimation
    this.selectEstimation.emit(newEstimation);
  }

  /**
   * Calcule les points de complexité pour une estimation donnée
   */
  calculateComplexityPoints(estimation: Estimation): number {
    const getValue = (label: string, axis: keyof typeof this.graduations): number => {
      const grads = this.graduations[axis];
      const grad = grads.find(g => g.label.toLowerCase() === label.toLowerCase());
      return grad?.value || 50;
    };

    const curseAverage = (
      getValue(estimation.complexity, 'complexity') +
      getValue(estimation.uncertainty, 'uncertainty') +
      getValue(estimation.risk, 'risk') +
      getValue(estimation.size, 'size') +
      getValue(estimation.effort, 'effort')
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
   * Détermine la T-shirt size pour une estimation donnée
   */
  getTShirtSize(estimation: Estimation): { size: string; min: number; max: number; bgColor: string; textColor: string } {
    const points = this.calculateComplexityPoints(estimation);
    
    for (const tShirt of this.tShirtSizes) {
      if (points < tShirt.max) {
        return tShirt;
      }
    }
    return this.tShirtSizes[this.tShirtSizes.length - 1];
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
}
