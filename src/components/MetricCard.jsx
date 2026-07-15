import React from 'react';
import { formatPercent } from '../utils/format.js';

function levelForPercent(percent) {
  if (percent == null) return 'unknown';
  if (percent >= 85) return 'critical';
  if (percent >= 65) return 'warning';
  return 'ok';
}

export default function MetricCard({ title, percent, subtitle, extra }) {
  const level = levelForPercent(percent);
  return (
    <div className={`metric-card metric-card--${level}`}>
      <div className="metric-card__header">
        <span className="metric-card__title">{title}</span>
        <span className="metric-card__value">{formatPercent(percent)}</span>
      </div>
      <div className="metric-card__bar-track">
        <div
          className="metric-card__bar-fill"
          style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
        />
      </div>
      {subtitle && <div className="metric-card__subtitle">{subtitle}</div>}
      {extra}
    </div>
  );
}
