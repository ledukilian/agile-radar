import { Injectable } from '@angular/core';
import Shepherd from 'shepherd.js';
import { EstimationService } from './estimation.service';

export interface TourStep {
  id: string;
  title: string;
  text: string;
  attachTo?: {
    element: string;
    on: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
  };
  buttons?: Array<{
    text: string;
    action: 'next' | 'back' | 'complete';
    classes?: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class TourService {
  private tour: Shepherd.Tour | null = null;
  private readonly TOUR_COMPLETED_KEY = 'agile-radar-tour-completed';
  private radarObserver: MutationObserver | null = null;

  constructor(private estimationService: EstimationService) {}

  /**
   * Vérifie si le tour a déjà été complété
   */
  isTourCompleted(): boolean {
    try {
      return localStorage.getItem(this.TOUR_COMPLETED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Marque le tour comme complété
   */
  markTourCompleted(): void {
    try {
      localStorage.setItem(this.TOUR_COMPLETED_KEY, 'true');
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Réinitialise le tour (pour permettre de le rejouer)
   */
  resetTour(): void {
    try {
      localStorage.removeItem(this.TOUR_COMPLETED_KEY);
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Initialise et démarre le tour guidé
   */
  startTour(): void {
    if (this.tour) {
      this.tour.complete();
    }

    // Désactiver le zoom pendant le tour pour éviter les décalages
    this.disableBodyZoom();

    // Attendre que le layout se stabilise après le changement de zoom
    setTimeout(() => {
      this.initAndStartTour();
    }, 50);
  }

  /**
   * Initialise et lance le tour après stabilisation du layout
   */
  private initAndStartTour(): void {
    // Créer automatiquement une estimation pour le tour si aucune n'existe
    const existingEstimations = this.estimationService.getAllEstimations();
    if (existingEstimations.length === 0) {
      this.createEstimationForTour();
      // Attendre que l'estimation soit créée, sélectionnée et que le DOM soit mis à jour
      // On attend un peu plus pour que le radar soit rendu
      setTimeout(() => {
        this.startTourInternal();
      }, 500);
    } else {
      this.startTourInternal();
    }
  }

  /**
   * Démarre le tour interne
   */
  private startTourInternal(): void {
    this.tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: {
          enabled: true
        },
        classes: 'shepherd-theme-custom',
        scrollTo: { behavior: 'smooth', block: 'center' },
        modalOverlayOpeningPadding: 20,
        modalOverlayOpeningRadius: 8
      }
    });

    // Définir les étapes du tour
    this.addTourSteps();

    // Événements du tour
    this.tour.on('complete', () => {
      this.markTourCompleted();
      this.restoreBodyZoom();
    });

    this.tour.on('cancel', () => {
      this.markTourCompleted();
      this.restoreBodyZoom();
    });

    this.tour.start();
  }

  /**
   * Désactive temporairement le zoom du body pour le tour
   */
  private disableBodyZoom(): void {
    document.body.classList.add('tour-active');
  }

  /**
   * Restaure le zoom du body après le tour
   */
  private restoreBodyZoom(): void {
    document.body.classList.remove('tour-active');
  }

  /**
   * Ajoute toutes les étapes du tour
   */
  private addTourSteps(): void {
    if (!this.tour) return;

    // Étape 1 : Bienvenue
    this.tour.addStep({
      id: 'welcome',
      title: '📡 Bienvenue sur Agile Radar !',
      text: `
        <p>Cet outil vous aide à <strong>estimer la complexité</strong> de vos User Stories et Features en utilisant la méthode <strong>CURSE</strong>.</p>
        <p class="mt-2 text-sm" style="color: #94a3b8;"><strong>C</strong>omplexity • <strong>U</strong>ncertainty • <strong>R</strong>isk • <strong>S</strong>ize • <strong>E</strong>ffort</p>
      `,
      buttons: [
        {
          text: 'Passer',
          action: this.tour.complete,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Commencer la visite',
          action: this.tour.next,
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Étape 2 : Liste des estimations
    this.tour.addStep({
      id: 'estimation-list',
      title: 'Liste des estimations',
      text: `
        <p>Ici s'affichent toutes vos <strong>estimations</strong> organisées par type :</p>
        <ul class="mt-2 text-sm" style="list-style: none; padding: 0;">
          <li style="margin-bottom: 0.5rem;">⭐ <strong>Feature</strong> : regroupe plusieurs User Stories pour une vision d'ensemble</li>
          <li>🧩 <strong>User Story</strong> : tâche unitaire à estimer individuellement</li>
        </ul>
      `,
      attachTo: {
        element: 'app-estimation-list .glass-card',
        on: 'right'
      },
      buttons: [
        {
          text: 'Retour',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Suivant',
          action: this.tour.next,
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Étape 3 : Filtres et recherche
    this.tour.addStep({
      id: 'filters-search',
      title: '🔍 Filtres et recherche',
      text: `
        <p>Retrouvez facilement vos estimations :</p>
        <ul class="mt-2 text-sm" style="list-style: none; padding: 0;">
          <li style="margin-bottom: 0.5rem;">🔎 <strong>Recherche</strong> : filtrez par nom</li>
          <li style="margin-bottom: 0.5rem;">🕐 <strong>Date</strong> : affichez/masquez les dates de modification</li>
          <li>👤 <strong>Auteur</strong> : filtrez par auteur (utile en équipe)</li>
        </ul>
      `,
      attachTo: {
        element: 'app-estimation-list .glass-card > div:first-child .mt-4',
        on: 'bottom'
      },
      buttons: [
        {
          text: 'Retour',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Suivant',
          action: this.tour.next,
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Étape 4 : Gestion des données (export/import)
    this.tour.addStep({
      id: 'data-management',
      title: 'Vos données',
      text: `
        <p>🔒 Vos estimations sont <strong>100% privées</strong> et stockées <strong>uniquement dans votre navigateur</strong>.</p>
        <p class="mt-2">Vous pouvez :</p>
        <ul class="mt-1 text-sm" style="list-style: none; padding: 0;">
          <li style="margin-bottom: 0.25rem;"><strong>Exporter</strong> vos données en JSON</li>
          <li style="margin-bottom: 0.25rem;"><strong>Importer</strong> des données existantes</li>
        </ul>
        <p class="mt-2">💡 Chaque estimation est unique. L'import fusionne les nouvelles estimations avec les existantes sans les écraser.</p>
      `,
      attachTo: {
        element: 'app-estimation-list .glass-card > .mt-4',
        on: 'top'
      },
      buttons: [
        {
          text: 'Retour',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Suivant',
          action: this.tour.next,
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Étape 5 : Bouton Ajouter - information sur la création d'estimations
    this.tour.addStep({
      id: 'add-button',
      title: 'Créer une estimation',
      text: `
        <p>Une estimation a été créée automatiquement pour vous permettre de découvrir l'outil !</p>
        <p class="mt-2" style="color: #64748b;">Vous pouvez créer d'autres estimations en cliquant sur <strong>"Ajouter"</strong>.</p>
        <p class="mt-2 text-sm" style="color: #64748b;">Il existe plusieurs types d'estimations :</p>
        <ul class="mt-1 text-sm" style="list-style: none; padding: 0;">
          <li>🧩 <strong>User Story</strong> : tâche individuelle</li>
          <li>⭐ <strong>Feature</strong> : regroupement de tâches</li>
        </ul>
      `,
      attachTo: {
        element: 'app-estimation-list button[title="Nouvelle estimation"]',
        on: 'bottom'
      },
      buttons: [
        {
          text: 'Retour',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Suivant',
          action: this.tour.next,
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Étape 6 : Radar Chart - visualisation
    this.tour.addStep({
      id: 'radar-chart',
      title: 'Diagramme radar',
      text: `
        <p>Le <strong>radar</strong> visualise les 5 curseurs d'évaluation CURSE de votre estimation :</p>
        <ul class="mt-2 text-sm" style="list-style: none; padding: 0;">
          <li style="margin-bottom: 0.25rem;"><span style="color: #eab308;">●</span> <strong>C</strong>omplexity : difficulté technique</li>
          <li style="margin-bottom: 0.25rem;"><span style="color: #a855f7;">●</span> <strong>U</strong>ncertainty : zones floues</li>
          <li style="margin-bottom: 0.25rem;"><span style="color: #ef4444;">●</span> <strong>R</strong>isk : dépendances, dangers</li>
          <li style="margin-bottom: 0.25rem;"><span style="color: #22c55e;">●</span> <strong>S</strong>ize : volume de travail</li>
          <li><span style="color: #3b82f6;">●</span> <strong>E</strong>ffort : pénibilité</li>
        </ul>
      `,
      attachTo: {
        element: 'app-radar-chart .glass-card',
        on: 'left'
      },
      beforeShowPromise: () => {
        return new Promise<void>((resolve) => {
          // Vérifier que l'élément du radar existe
          const checkElement = () => {
            const radarElement = document.querySelector('app-radar-chart .glass-card');
            if (radarElement) {
              resolve();
            } else {
              // Réessayer après un court délai
              setTimeout(checkElement, 100);
            }
          };
          checkElement();
        });
      },
      buttons: [
        {
          text: 'Retour',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Suivant',
          action: this.tour.next,
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Étape 7 : Taille T-Shirt
    this.tour.addStep({
      id: 'tshirt-size',
      title: '👕 Taille T-Shirt',
      text: `
        <p>Chaque estimation reçoit automatiquement une <strong>taille de T-Shirt</strong> selon sa complexité :</p>
        <p class="mt-2" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <span style="padding: 0.25rem 0.5rem; background: #dcfce7; color: #15803d; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 700;">XS</span>
          <span style="padding: 0.25rem 0.5rem; background: #dcfce7; color: #15803d; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 700;">S</span>
          <span style="padding: 0.25rem 0.5rem; background: #fef9c3; color: #a16207; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 700;">M</span>
          <span style="padding: 0.25rem 0.5rem; background: #ffedd5; color: #c2410c; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 700;">L</span>
          <span style="padding: 0.25rem 0.5rem; background: #fee2e2; color: #b91c1c; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 700;">XL</span>
        </p>
      `,
      attachTo: {
        element: 'app-radar-chart .glass-card > div:first-child > div:first-child > span:first-child',
        on: 'bottom'
      },
      buttons: [
        {
          text: 'Retour',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Suivant',
          action: this.tour.next,
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Étape 8 : Points de complexité
    this.tour.addStep({
      id: 'complexity-points',
      title: 'Points de complexité',
      text: `
        <p>Les <strong>points de complexité</strong> sont calculés automatiquement à partir des curseurs d'évaluation CURSE.</p>
        <p class="mt-2 text-sm" style="color: #94a3b8;">Ils reflètent la difficulté globale de l'estimation et sont utilisés pour déterminer la taille T-Shirt.</p>
      `,
      attachTo: {
        element: 'app-radar-chart .glass-card > div:first-child > div:first-child > span:last-child',
        on: 'bottom'
      },
      buttons: [
        {
          text: 'Retour',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Suivant',
          action: this.tour.next,
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Étape 9 : Boutons du radar (export, détails)
    this.tour.addStep({
      id: 'radar-actions',
      title: '🔧 Actions sur le radar',
      text: `
        <p>Sous le radar, vous trouverez plusieurs actions :</p>
        <ul class="mt-2 text-sm" style="list-style: none; padding: 0;">
          <li style="margin-bottom: 0.5rem;">📥 <strong>Exporter en JPG</strong> : téléchargez une image du radar</li>
          <li style="margin-bottom: 0.5rem;">📋 <strong>Copier</strong> : copiez l'image dans le presse-papier</li>
          <li>⚙️ <strong>Détails</strong> : ouvrez le panneau d'édition</li>
        </ul>
      `,
      attachTo: {
        element: 'app-radar-chart > div:last-child',
        on: 'top'
      },
      buttons: [
        {
          text: 'Retour',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Suivant',
          action: this.tour.next,
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Étape 10 : Onglet Informations
    this.tour.addStep({
      id: 'tab-informations',
      title: 'Onglet informations',
      text: `
        <p>L'onglet <strong>Informations</strong> permet de définir les détails de base de votre estimation.</p>
      `,
      attachTo: {
        element: 'app-estimation-form .inline-flex button:first-child',
        on: 'bottom'
      },
      buttons: [
        {
          text: 'Retour',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Suivant',
          action: this.tour.next,
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Étape 11 : Onglet Évaluation
    this.tour.addStep({
      id: 'tab-evaluation',
      title: '⚖️ Onglet Évaluation',
      text: `
        <p>L'onglet <strong>Évaluation</strong> est le cœur de l'estimation CURSE.</p>
      `,
      attachTo: {
        element: 'app-estimation-form .inline-flex button:nth-child(2)',
        on: 'bottom'
      },
      buttons: [
        {
          text: 'Retour',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Suivant',
          action: this.tour.next,
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Étape 12 : Onglet Conseils
    this.tour.addStep({
      id: 'tab-conseils',
      title: 'Onglet conseils',
      text: `
        <p>L'onglet <strong>Conseils</strong> vous guide dans votre estimation.</p>
      `,
      attachTo: {
        element: 'app-estimation-form .inline-flex button:nth-child(3)',
        on: 'bottom'
      },
      buttons: [
        {
          text: 'Retour',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Suivant',
          action: this.tour.next,
          classes: 'shepherd-button-primary'
        }
      ]
    });

    // Étape 13 : Paramètres
    this.tour.addStep({
      id: 'settings',
      title: '⚙️ Paramètres',
      text: `
        <p>Personnalisez l'application selon vos besoins</p>
      `,
      attachTo: {
        element: 'button[title="Paramètres"]',
        on: 'bottom'
      },
      buttons: [
        {
          text: 'Retour',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Terminer la visite',
          action: this.tour.complete,
          classes: 'shepherd-button-primary shepherd-button-finish'
        }
      ]
    });
  }

  /**
   * Arrête le tour en cours
   */
  stopTour(): void {
    if (this.tour) {
      this.tour.complete();
      this.tour = null;
    }
    this.cleanupObserver();
  }

  /**
   * Configure un observer pour détecter quand le radar apparaît
   */
  private setupRadarObserver(): void {
    this.cleanupObserver();

    // Observer le DOM pour détecter l'apparition du canvas du radar
    this.radarObserver = new MutationObserver((mutations) => {
      const radarCanvas = document.querySelector('app-radar-chart canvas');
      if (radarCanvas && this.tour) {
        // Le radar est apparu, passer à l'étape suivante
        setTimeout(() => {
          if (this.tour && this.tour.getCurrentStep()?.id === 'add-button') {
            this.tour.next();
          }
        }, 300);
        this.cleanupObserver();
      }
    });

    this.radarObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Nettoie l'observer
   */
  private cleanupObserver(): void {
    if (this.radarObserver) {
      this.radarObserver.disconnect();
      this.radarObserver = null;
    }
  }

  /**
   * Crée une estimation pour le tour guidé
   */
  private createEstimationForTour(): void {
    // Créer une nouvelle estimation avec des valeurs par défaut
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

    // Déclencher un événement personnalisé pour notifier AppComponent
    // Cela permettra de sélectionner et d'ouvrir l'estimation en mode édition
    const event = new CustomEvent('tour-estimation-created', {
      detail: { estimation: newEstimation }
    });
    document.dispatchEvent(event);
  }
}
