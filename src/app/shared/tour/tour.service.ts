import { Injectable } from '@angular/core';
import Shepherd from 'shepherd.js';

const TOUR_KEY = 'agile_radar_tour_done';

/**
 * Tour d'onboarding basé sur shepherd.js, adapté à l'espace de travail unifié.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private tour: Shepherd.Tour | null = null;

  isDone(): boolean {
    try {
      return localStorage.getItem(TOUR_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private markDone(): void {
    try {
      localStorage.setItem(TOUR_KEY, 'true');
    } catch {
      /* ignore */
    }
  }

  start(): void {
    if (this.tour) this.tour.complete();

    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: { enabled: true },
        classes: 'shepherd-theme-custom',
        scrollTo: { behavior: 'smooth', block: 'center' },
        modalOverlayOpeningPadding: 8,
        modalOverlayOpeningRadius: 8
      }
    });
    this.tour = tour;

    const next = { text: 'Suivant', action: () => tour.next(), classes: 'shepherd-button-primary' };
    const back = { text: 'Retour', action: () => tour.back(), classes: 'shepherd-button-secondary' };

    tour.addStep({
      id: 'welcome',
      title: 'Bienvenue sur Agile Radar',
      text: `
        <p>Planifiez vos itérations en fusionnant <strong>chiffrage</strong> et <strong>planification</strong>.</p>
        <p class="mt-2 text-sm">Estimez en points Fibonacci, placez les éléments dans les itérations, et laissez le moteur calculer l'atterrissage.</p>`,
      buttons: [
        { text: 'Passer', action: () => tour.complete(), classes: 'shepherd-button-secondary' },
        { text: 'Commencer', action: () => tour.next(), classes: 'shepherd-button-primary' }
      ]
    });

    tour.addStep({
      id: 'config',
      title: 'Configuration',
      text: '<p>Définissez ici vos itérations, la capacité (jours-homme × ratio), les réserves et les axes CURSE.</p>',
      attachTo: { element: '[data-tour="config"]', on: 'bottom' },
      buttons: [back, next]
    });

    tour.addStep({
      id: 'backlog',
      title: 'Le backlog',
      text: "<p>Créez vos éléments (Epic, Feature, US, Bug…) avec le bouton <strong>Nouveau</strong>. Ils apparaissent ici tant qu'ils ne sont pas planifiés.</p>",
      attachTo: { element: '[data-tour="backlog"]', on: 'right' },
      buttons: [back, next]
    });

    tour.addStep({
      id: 'toolbar',
      title: 'Barre d\'outils',
      text: "<p>Ajoutez des itérations, filtrez par type, et annotez le board (notes, dessin, export PNG). L'atterrissage des éléments se recalcule automatiquement.</p>",
      attachTo: { element: '[data-tour="toolbar"]', on: 'bottom' },
      buttons: [back, next]
    });

    tour.addStep({
      id: 'insights',
      title: 'Insights',
      text: '<p>Des alertes pilotées par les données : surcharges, débordements, dépendances violées, features qui glissent.</p>',
      attachTo: { element: '[data-tour="insights"]', on: 'left' },
      buttons: [
        back,
        { text: 'Terminer', action: () => tour.complete(), classes: 'shepherd-button-primary' }
      ]
    });

    tour.on('complete', () => this.markDone());
    tour.on('cancel', () => this.markDone());

    tour.start();
  }
}
