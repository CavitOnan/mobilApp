const Store = require('electron-store');

const LIVE_MAX_POINTS = 150; // ~5 dakika (2sn aralıklarla)
const PERSIST_SAMPLE_INTERVAL_MS = 60 * 1000; // her 1 dakikada bir kalıcı örnek al
const PERSIST_MAX_POINTS = 24 * 60; // 24 saatlik dakikalık örnek

class HistoryStore {
  constructor() {
    this.store = new Store({ name: 'performance-history' });
    this.live = [];
    this.persisted = this.store.get('samples', []);
    this.lastPersistTs = 0;
  }

  addSnapshot(snapshot) {
    const point = {
      timestamp: snapshot.timestamp,
      cpuPercent: snapshot.cpu.loadPercent,
      memPercent: snapshot.memory.usedPercent,
      diskPercent: snapshot.disk.usedPercent,
      gpuPercent: snapshot.gpu.averageUtilizationPercent,
      batteryPercent: snapshot.battery.hasBattery ? snapshot.battery.percent : null,
      netRxKBs: Math.round(snapshot.network.rxBytesPerSec / 1024),
      netTxKBs: Math.round(snapshot.network.txBytesPerSec / 1024),
    };

    this.live.push(point);
    if (this.live.length > LIVE_MAX_POINTS) {
      this.live.shift();
    }

    if (snapshot.timestamp - this.lastPersistTs >= PERSIST_SAMPLE_INTERVAL_MS) {
      this.lastPersistTs = snapshot.timestamp;
      this.persisted.push(point);
      if (this.persisted.length > PERSIST_MAX_POINTS) {
        this.persisted.shift();
      }
      this.store.set('samples', this.persisted);
    }

    return point;
  }

  getAll() {
    return {
      live: this.live,
      persisted: this.persisted,
    };
  }
}

module.exports = { HistoryStore, LIVE_MAX_POINTS, PERSIST_MAX_POINTS };
