const si = require('systeminformation');
const { execFile } = require('child_process');

const POLL_INTERVAL_MS = 2000;

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 5000 },
      (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.trim());
      }
    );
  });
}

// Anakartın/RAM dizisinin desteklediği azami bellek kapasitesini (ve toplam slot
// sayısını) Windows WMI üzerinden okur. systeminformation kütüphanesi bu bilgiyi
// (Win32_PhysicalMemoryArray) doğrudan sunmadığı için ayrıca sorgulanır.
// Sadece Windows'ta çalışır; diğer platformlarda veya sorgu başarısız olursa null döner.
async function getMemoryHardwareLimits() {
  if (process.platform !== 'win32') return null;
  try {
    const json = await runPowerShell(
      'Get-CimInstance Win32_PhysicalMemoryArray | Select-Object MaxCapacity, MaxCapacityEx, MemoryDevices | ConvertTo-Json -Compress'
    );
    if (!json) return null;
    const parsed = JSON.parse(json);
    const entry = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!entry) return null;

    // MaxCapacity KB cinsindendir ve 32-bit olduğundan büyük (>~4TB, pratikte >32GB
    // raporlanan bazı sistemlerde) değerlerde MaxCapacityEx (KB, 64-bit) daha güvenilirdir.
    const maxCapacityKB =
      entry.MaxCapacityEx && entry.MaxCapacityEx > 0 ? entry.MaxCapacityEx : entry.MaxCapacity;

    return {
      maxCapacityBytes: maxCapacityKB ? maxCapacityKB * 1024 : null,
      totalSlots: typeof entry.MemoryDevices === 'number' ? entry.MemoryDevices : null,
    };
  } catch (err) {
    console.error('[collector] RAM donanım limiti alınamadı:', err.message);
    return null;
  }
}

async function collectStaticInfo() {
  const [cpu, osInfo, system, chassis, memLayout, memHardwareLimits] = await Promise.all([
    si.cpu(),
    si.osInfo(),
    si.system(),
    si.chassis().catch(() => ({ type: null })),
    si.memLayout().catch(() => []),
    getMemoryHardwareLimits(),
  ]);

  const populatedSlots = memLayout.filter((m) => m.size > 0).length;
  const isLaptop = /laptop|notebook|portable|sub notebook|hand held/i.test(chassis.type || '');

  return {
    cpuBrand: `${cpu.manufacturer} ${cpu.brand}`.trim(),
    cpuCores: cpu.cores,
    cpuPhysicalCores: cpu.physicalCores,
    osDistro: osInfo.distro,
    osArch: osInfo.arch,
    hostname: osInfo.hostname,
    manufacturer: system.manufacturer,
    model: system.model,
    isLaptop,
    memoryHardware: {
      slotsUsed: populatedSlots,
      slotsTotal: memHardwareLimits?.totalSlots ?? null,
      maxCapacityBytes: memHardwareLimits?.maxCapacityBytes ?? null,
    },
  };
}

async function collectSnapshot() {
  const [
    currentLoad,
    mem,
    fsSize,
    graphics,
    battery,
    networkStats,
    cpuTemperature,
  ] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.graphics(),
    si.battery(),
    si.networkStats(),
    si.cpuTemperature().catch(() => ({ main: null })),
  ]);

  const totalDisk = fsSize.reduce((acc, d) => acc + d.size, 0);
  const usedDisk = fsSize.reduce((acc, d) => acc + d.used, 0);

  const netTotals = networkStats.reduce(
    (acc, iface) => {
      acc.rxSec += iface.rx_sec || 0;
      acc.txSec += iface.tx_sec || 0;
      return acc;
    },
    { rxSec: 0, txSec: 0 }
  );

  const gpuLoad = graphics.controllers?.length
    ? graphics.controllers
        .map((c) => c.utilizationGpu)
        .filter((v) => typeof v === 'number')
    : [];

  return {
    timestamp: Date.now(),
    cpu: {
      loadPercent: Number(currentLoad.currentLoad.toFixed(1)),
      perCore: currentLoad.cpus.map((c) => Number(c.load.toFixed(1))),
      temperature: cpuTemperature.main,
    },
    memory: {
      totalBytes: mem.total,
      usedBytes: mem.active,
      freeBytes: mem.available,
      usedPercent: Number(((mem.active / mem.total) * 100).toFixed(1)),
      swapUsedBytes: mem.swapused,
      swapTotalBytes: mem.swaptotal,
    },
    disk: {
      totalBytes: totalDisk,
      usedBytes: usedDisk,
      usedPercent: totalDisk ? Number(((usedDisk / totalDisk) * 100).toFixed(1)) : 0,
      volumes: fsSize.map((d) => ({
        mount: d.mount,
        totalBytes: d.size,
        usedBytes: d.used,
        usedPercent: Number((d.use || 0).toFixed(1)),
      })),
    },
    gpu: {
      controllers: graphics.controllers.map((c) => ({
        model: c.model,
        vendor: c.vendor,
        utilizationPercent: c.utilizationGpu ?? null,
        memoryTotalMB: c.memoryTotal ?? null,
        memoryUsedMB: c.memoryUsed ?? null,
        temperature: c.temperatureGpu ?? null,
      })),
      averageUtilizationPercent: gpuLoad.length
        ? Number((gpuLoad.reduce((a, b) => a + b, 0) / gpuLoad.length).toFixed(1))
        : null,
    },
    battery: {
      hasBattery: battery.hasBattery,
      isCharging: battery.isCharging,
      percent: battery.percent,
      cycleCount: battery.cycleCount ?? null,
      maxCapacity: battery.maxCapacity ?? null,
      designedCapacity: battery.designedCapacity ?? null,
      acConnected: battery.acConnected,
    },
    network: {
      rxBytesPerSec: Math.round(netTotals.rxSec),
      txBytesPerSec: Math.round(netTotals.txSec),
    },
  };
}

function startCollector(onSnapshot) {
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      const snapshot = await collectSnapshot();
      if (!stopped) onSnapshot(snapshot);
    } catch (err) {
      console.error('[collector] metrik toplama hatası:', err);
    } finally {
      if (!stopped) setTimeout(tick, POLL_INTERVAL_MS);
    }
  };

  tick();

  return () => {
    stopped = true;
  };
}

module.exports = {
  POLL_INTERVAL_MS,
  collectSnapshot,
  collectStaticInfo,
  startCollector,
};
