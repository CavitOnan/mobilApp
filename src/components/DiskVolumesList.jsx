import React from 'react';
import { formatBytes } from '../utils/format.js';

export default function DiskVolumesList({ volumes }) {
  if (!volumes || volumes.length === 0) return null;
  return (
    <div className="volume-list">
      {volumes.map((v) => (
        <div className="volume-row" key={v.mount}>
          <span className="volume-row__mount">{v.mount}</span>
          <div className="volume-row__bar-track">
            <div
              className={`volume-row__bar-fill ${v.usedPercent >= 90 ? 'volume-row__bar-fill--critical' : v.usedPercent >= 75 ? 'volume-row__bar-fill--warning' : ''}`}
              style={{ width: `${Math.min(100, v.usedPercent)}%` }}
            />
          </div>
          <span className="volume-row__label">
            %{v.usedPercent.toFixed(0)} · {formatBytes(v.usedBytes)} / {formatBytes(v.totalBytes)}
          </span>
        </div>
      ))}
    </div>
  );
}
