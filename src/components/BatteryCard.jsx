import React from 'react';

export default function BatteryCard({ battery }) {
  if (!battery || !battery.hasBattery) {
    return (
      <div className="metric-card metric-card--ok">
        <div className="metric-card__header">
          <span className="metric-card__title">Batarya</span>
          <span className="metric-card__value">—</span>
        </div>
        <div className="metric-card__subtitle">Batarya algılanmadı (masaüstü/sanal makine olabilir)</div>
      </div>
    );
  }

  const level = battery.percent <= 15 && !battery.acConnected ? 'critical' : battery.percent <= 30 ? 'warning' : 'ok';
  const status = battery.isCharging
    ? 'Şarj oluyor'
    : battery.acConnected
      ? 'Prize takılı'
      : 'Pilde çalışıyor';

  return (
    <div className={`metric-card metric-card--${level}`}>
      <div className="metric-card__header">
        <span className="metric-card__title">Batarya</span>
        <span className="metric-card__value">%{battery.percent}</span>
      </div>
      <div className="metric-card__bar-track">
        <div className="metric-card__bar-fill" style={{ width: `${battery.percent}%` }} />
      </div>
      <div className="metric-card__subtitle">{status}</div>
    </div>
  );
}
