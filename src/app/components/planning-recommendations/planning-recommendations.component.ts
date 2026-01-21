import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { PlanningService } from '../../services/planning.service';
import { PlanningRecommendation } from '../../models/planning.model';

@Component({
  selector: 'app-planning-recommendations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './planning-recommendations.component.html',
  styleUrl: './planning-recommendations.component.scss'
})
export class PlanningRecommendationsComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();

  recommendations: PlanningRecommendation[] = [];
  
  private subscription?: Subscription;

  constructor(private planningService: PlanningService) {}

  ngOnInit(): void {
    this.loadRecommendations();
    
    // S'abonner aux changements du board pour mettre à jour les recommandations
    this.subscription = this.planningService.board$.subscribe(() => {
      this.loadRecommendations();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private loadRecommendations(): void {
    this.recommendations = this.planningService.getPlanningRecommendations();
  }

  // ==================== HELPERS ====================

  get dangerRecommendations(): PlanningRecommendation[] {
    return this.recommendations.filter(r => r.type === 'danger');
  }

  get warningRecommendations(): PlanningRecommendation[] {
    return this.recommendations.filter(r => r.type === 'warning');
  }

  get infoRecommendations(): PlanningRecommendation[] {
    return this.recommendations.filter(r => r.type === 'info');
  }

  get successRecommendations(): PlanningRecommendation[] {
    return this.recommendations.filter(r => r.type === 'success');
  }

  getTypeClass(type: string): string {
    switch (type) {
      case 'danger': return 'recommendation-danger';
      case 'warning': return 'recommendation-warning';
      case 'info': return 'recommendation-info';
      case 'success': return 'recommendation-success';
      default: return '';
    }
  }

  getTypeBgClass(type: string): string {
    switch (type) {
      case 'danger': return 'bg-red-500/10 border-red-500/30';
      case 'warning': return 'bg-amber-500/10 border-amber-500/30';
      case 'info': return 'bg-blue-500/10 border-blue-500/30';
      case 'success': return 'bg-green-500/10 border-green-500/30';
      default: return '';
    }
  }

  getTypeIconBg(type: string): string {
    switch (type) {
      case 'danger': return 'bg-red-500/20';
      case 'warning': return 'bg-amber-500/20';
      case 'info': return 'bg-blue-500/20';
      case 'success': return 'bg-green-500/20';
      default: return '';
    }
  }

  trackByIndex(index: number): number {
    return index;
  }
}
