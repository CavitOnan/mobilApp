import React, { useEffect, useMemo, useState } from 'react';
import MetricCard from './components/MetricCard.jsx';
import DiskVolumesList from './components/DiskVolumesList.jsx';
import BatteryCard from './components/BatteryCard.jsx';
import NetworkCard from './components/NetworkCard.jsx';
import HistoryChart from './components/HistoryChart.jsx';
import RecommendationsPanel from './components/RecommendationsPanel.jsx';
import { formatBytes, formatPercent } from './utils/format.js';

const hasBridge = typeof window !== 'undefined' && !!window.perfMonitor;

export default function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [liveHistory, setLiveHistory] = useState([]);
  const [staticInfo, setStaticInfo] = useState(null);

  useEffect(() => {
    if (!hasBridge) return undefined;

    window.perfMonitor.getHistory().then((h) => setLiveHistory(h.live || []));
    window.perfMonitor.getStaticInfo().then(setStaticInfo);

    const offMetrics = window.perfMonitor.onMetrics((data) => {
      setSnapshot(data);
      setLiveHistory((prev) => {
        const point = {
          timestamp: data.timestamp,
          cpuPercent: data.cpu.loadPercent,
          memPercent: data.memory.usedPercent,
          diskPercent: data.disk.usedPercent,
          gpuPercent: data.gpu.averageUtilizationPercent,
        };
        const next = [...prev, point];
        return next.length > 150 ? next.slice(next.length - 150) : next;
      });
    });

    const offRecs = window.perfMonitor.onRecommendations((data) => setRecommendations(data));

    return () => {
      offMetrics && offMetrics();
      offRecs && offRecs();
    };
  }, []);

  const criticalCount = useMemo(
    () => recommendations.filter((r) => r.severity === 'critical').length,
    [recommendations]
  );

  if (!hasBridge) {
    return (
      <div className="app app--error">
        <p>Bu arayüz yalnızca Electron uygulaması içinde çalışır.</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="app app--loading">
        <p>Performans verileri toplanıyor…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Laptop Perf Monitoring</h1>
          {staticInfo && (
            <p className="app__subtitle">
              {staticInfo.cpuBrand} · {staticInfo.osDistro} · {staticInfo.cpuPhysicalCores} çekirdek
            </p>
          )}
        </div>
        <button className="app__minimize-btn" onClick={() => window.perfMonitor.minimizeToTray()}>
          Tepsiye küçült
        </button>
      </header>

      <section className="metrics-grid">
        <MetricCard title="CPU" percent={snapshot.cpu.loadPercent} subtitle={
          snapshot.cpu.temperature != null ? `Sıcaklık: ${snapshot.cpu.temperature}°C` : undefined
        } />
        <MetricCard
          title="RAM"
          percent={snapshot.memory.usedPercent}
          subtitle={`${formatBytes(snapshot.memory.usedBytes)} / ${formatBytes(snapshot.memory.totalBytes)}${
            staticInfo?.memoryHardware?.maxCapacityBytes
              ? ` · azami ${formatBytes(staticInfo.memoryHardware.maxCapacityBytes)}`
              : ''
          }`}
        />
        <MetricCard
          title="Disk"
          percent={snapshot.disk.usedPercent}
          extra={<DiskVolumesList volumes={snapshot.disk.volumes} />}
        />
        <MetricCard
          title="GPU"
          percent={snapshot.gpu.averageUtilizationPercent}
          subtitle={snapshot.gpu.controllers[0]?.model || 'GPU bulunamadı'}
        />
        <BatteryCard battery={snapshot.battery} />
        <NetworkCard network={snapshot.network} />
      </section>

      <section className="panel">
        <h2>Geçmiş (son 5 dakika)</h2>
        <HistoryChart data={liveHistory} />
      </section>

      <section className="panel">
        <h2>
          Öneriler
          {criticalCount > 0 && <span className="critical-count-badge">{criticalCount} kritik</span>}
        </h2>
        <RecommendationsPanel recommendations={recommendations} />
      </section>
    </div>
  );
}
