import React from 'react';

const SEVERITY_LABEL = {
  critical: 'Kritik',
  warning: 'Uyarı',
  info: 'Bilgi',
};

export default function RecommendationsPanel({ recommendations }) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="recommendations-empty">
        <span className="recommendations-empty__icon">✓</span>
        <div>
          <div className="recommendations-empty__title">Her şey yolunda görünüyor</div>
          <div className="recommendations-empty__subtitle">
            Şu anda dikkat gerektiren bir performans sorunu tespit edilmedi.
          </div>
        </div>
      </div>
    );
  }

  return (
    <ul className="recommendations-list">
      {recommendations.map((rec) => (
        <li key={rec.id} className={`recommendation recommendation--${rec.severity}`}>
          <span className={`recommendation__badge recommendation__badge--${rec.severity}`}>
            {SEVERITY_LABEL[rec.severity] || rec.severity}
          </span>
          <div>
            <div className="recommendation__title">{rec.title}</div>
            <div className="recommendation__description">{rec.description}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
