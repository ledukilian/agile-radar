import { AfterViewInit, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectStore } from './core/store/project.store';
import { TourService } from './shared/tour/tour.service';
import { WorkspaceComponent } from './features/workspace/workspace.component';
import { SetupComponent } from './features/setup/setup.component';
import { ItemDetailComponent } from './features/item-detail/item-detail.component';
import { IterationSettingsComponent } from './features/iteration-settings/iteration-settings.component';
import { InsightsPanelComponent } from './features/insights/insights-panel.component';
import { IconComponent } from './shared/icon/icon.component';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    WorkspaceComponent,
    SetupComponent,
    ItemDetailComponent,
    IterationSettingsComponent,
    InsightsPanelComponent,
    IconComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements AfterViewInit {
  readonly store = inject(ProjectStore);
  readonly tour = inject(TourService);
  readonly version = environment.version;

  ngAfterViewInit(): void {
    if (!this.tour.isDone()) {
      setTimeout(() => this.tour.start(), 600);
    }
  }

  startTour(): void {
    this.tour.start();
  }

  readonly showSetup = signal(false);
  readonly showInsights = signal(false);
  readonly showDataMenu = signal(false);
  readonly selectedItemId = signal<string | null>(null);
  readonly selectedIterationId = signal<string | null>(null);

  readonly projectName = computed(() => this.store.project().name);

  openSetup(): void {
    this.showSetup.set(true);
  }
  closeSetup(): void {
    this.showSetup.set(false);
  }

  openIterationSettings(id: string): void {
    this.selectedIterationId.set(id);
  }
  closeIterationSettings(): void {
    this.selectedIterationId.set(null);
  }

  toggleInsights(): void {
    this.showInsights.update(v => !v);
  }

  toggleDataMenu(): void {
    this.showDataMenu.update(v => !v);
  }
  closeDataMenu(): void {
    this.showDataMenu.set(false);
  }

  openItem(id: string): void {
    this.selectedItemId.set(id);
  }
  closeItem(): void {
    this.selectedItemId.set(null);
  }

  deleteAll(): void {
    if (!confirm('Supprimer tout le contenu du projet ? Cette action est irréversible — pensez à exporter avant de continuer.')) {
      return;
    }
    this.store.newProject();
    this.closeDataMenu();
  }

  exportProject(): void {
    this.store.downloadJson();
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.store.importJson(reader.result as string);
      } catch {
        alert('Fichier JSON invalide.');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }
}
