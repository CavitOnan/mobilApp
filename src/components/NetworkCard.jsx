import React from 'react';
import { formatThroughput } from '../utils/format.js';

export default function NetworkCard({ network }) {
  return (
    <div className="metric-card metric-card--ok metric-card--network">
      <div className="metric-card__header">
        <span className="metric-card__title">Ağ</span>
      </div>
      <div className="network-rows">
        <div className="network-row">
          <span>↓ İndirme</span>
          <span>{formatThroughput(network?.rxBytesPerSec ?? 0)}</span>
        </div>
        <div className="network-row">
          <span>↑ Yükleme</span>
          <span>{formatThroughput(network?.txBytesPerSec ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}
