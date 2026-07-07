import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { CurseAxis } from '../../core/models/config.model';
import { CurseScores } from '../../core/models/work-item.model';

Chart.register(...registerables);

/**
 * Radar CURSE réutilisable (aide à la décision).
 * Affiche les axes activés et leurs valeurs 0-100.
 */
@Component({
  selector: 'app-radar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-host">
      <canvas #chartCanvas></canvas>
    </div>
  `,
  styles: [`
    .chart-host {
      position: relative;
      width: 100%;
      max-width: 320px;
      height: 260px;
      margin: 0 auto;
    }
  `]
})
export class RadarChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() axes: CurseAxis[] = [];
  @Input() scores: CurseScores = {};
  @Input() accentColor = '#3b82f6';

  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.createChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) return;
    if (changes['axes']) {
      this.createChart();
      return;
    }
    if (this.chart && (changes['scores'] || changes['accentColor'])) {
      this.syncChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = undefined;
  }

  private get activeAxes(): CurseAxis[] {
    return this.axes.filter(a => a.enabled);
  }

  private buildData(): ChartConfiguration<'radar'>['data'] {
    const axes = this.activeAxes;
    return {
      labels: axes.map(a => a.label),
      datasets: [
        {
          label: 'CURSE',
          data: axes.map(a => this.scores[a.key] ?? 0),
          backgroundColor: this.hexToRgba(this.accentColor, 0.2),
          borderColor: this.accentColor,
          borderWidth: 2,
          pointBackgroundColor: axes.map(a => a.color),
          pointBorderColor: '#fff',
          pointRadius: 6,
          pointHoverRadius: 8
        }
      ]
    };
  }

  private buildOptions(): NonNullable<ChartConfiguration<'radar'>['options']> {
    const colors = this.activeAxes.map(a => a.color);
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { stepSize: 20, display: false },
          grid: { color: 'rgba(128,128,128,0.2)' },
          angleLines: { color: 'rgba(128,128,128,0.2)' },
          pointLabels: {
            font: { size: 12, weight: 'bold' },
            color: (ctx) => colors[ctx.index] ?? '#94a3b8'
          }
        }
      },
      plugins: { legend: { display: false } }
    };
  }

  private createChart(): void {
    const canvas = this.chartCanvas?.nativeElement;
    if (!canvas || this.activeAxes.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.chart?.destroy();
    this.chart = new Chart(ctx, {
      type: 'radar',
      data: this.buildData(),
      options: this.buildOptions()
    });
  }

  private syncChart(): void {
    if (!this.chart) return;
    this.chart.data = this.buildData();
    this.chart.update('none');
  }

  private hexToRgba(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
