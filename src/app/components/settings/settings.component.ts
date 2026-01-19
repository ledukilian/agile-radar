import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../services/settings.service';
import { Taille, BaseSettings } from '../../models/estimation.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  // Onglets
  activeTab: 'base' | 'curseurs' = 'base';

  // Paramètres de base
  baseSettings: BaseSettings = {
    title: '',
    date: '',
    description: '',
    author: ''
  };

  // Curseurs (tailles)
  tailles: Taille[] = [];
  editingIndex: number | null = null;

  constructor(private settingsService: SettingsService) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loadBaseSettings();
    this.loadTailles();
  }

  loadBaseSettings(): void {
    this.baseSettings = { ...this.settingsService.getBaseSettings() };
  }

  loadTailles(): void {
    this.tailles = this.settingsService.getTailles().map(t => ({ ...t }));
  }

  setActiveTab(tab: 'base' | 'curseurs'): void {
    this.activeTab = tab;
  }

  addTaille(): void {
    const newTaille: Taille = {
      label: '',
      value: 50,
      description: ''
    };
    this.tailles.push(newTaille);
    this.editingIndex = this.tailles.length - 1;
  }

  removeTaille(index: number): void {
    if (this.tailles.length > 2) {
      this.tailles.splice(index, 1);
      if (this.editingIndex === index) {
        this.editingIndex = null;
      } else if (this.editingIndex !== null && this.editingIndex > index) {
        this.editingIndex--;
      }
    }
  }

  save(): void {
    if (this.activeTab === 'base') {
      this.saveBaseSettings();
    } else {
      this.saveTailles();
    }
  }

  saveBaseSettings(): void {
    // Validation des paramètres de base
    if (!this.baseSettings.title.trim()) {
      alert('Le titre est obligatoire');
      return;
    }

    this.settingsService.updateBaseSettings(this.baseSettings);
    alert('Paramètres de base sauvegardés avec succès !');
  }

  saveTailles(): void {
    // Validation
    if (this.tailles.length < 2) {
      alert('Veuillez définir au moins 2 tailles');
      return;
    }

    // Vérifier que les labels sont uniques
    const labels = this.tailles.map(t => t.label.trim().toUpperCase());
    if (new Set(labels).size !== labels.length) {
      alert('Les labels doivent être uniques');
      return;
    }

    // Vérifier que les valeurs sont dans [0, 100]
    if (this.tailles.some(t => t.value < 0 || t.value > 100)) {
      alert('Les valeurs doivent être entre 0 et 100');
      return;
    }

    this.settingsService.updateTailles(this.tailles);
    this.editingIndex = null;
    alert('Curseurs sauvegardés avec succès !');
  }

  cancel(): void {
    if (this.activeTab === 'base') {
      this.loadBaseSettings();
    } else {
      this.loadTailles();
      this.editingIndex = null;
    }
  }

  reset(): void {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser à la configuration par défaut ?')) {
      this.settingsService.resetToDefault();
      this.loadSettings();
      this.editingIndex = null;
    }
  }

  isEditing(index: number): boolean {
    return this.editingIndex === index;
  }

  startEditing(index: number): void {
    this.editingIndex = index;
  }

  stopEditing(): void {
    this.editingIndex = null;
  }
}
