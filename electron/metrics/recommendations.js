const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

const THRESHOLDS = {
  cpuSustainedWindow: 15, // ~30 saniye (2sn * 15)
  cpuSustainedPercent: 85,
  cpuCriticalPercent: 95,
  memWarningPercent: 80,
  memCriticalPercent: 90,
  diskWarningPercent: 80,
  diskCriticalPercent: 92,
  cpuTempWarning: 80,
  cpuTempCritical: 90,
  gpuTempWarning: 80,
  gpuTempCritical: 90,
  batteryLowPercent: 15,
  batteryHealthWarningPercent: 80,
  batteryCycleCountWarning: 800,
};

function average(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function formatGB(bytes) {
  if (!bytes) return null;
  return Math.round((bytes / 1024 ** 3) * 10) / 10;
}

// CPU sürekli/kritik yüksekken eklenecek not: dizüstülerde işlemci neredeyse
// hiçbir zaman yükseltilebilir olmadığından (anakarta lehimli), burada bir
// "azami değer" önerisi yerine bu sınırlamayı açıklayan bir not döndürülür.
function buildCpuUpgradeNote(staticInfo) {
  if (staticInfo?.isLaptop) {
    return ' Dizüstü bilgisayarlarda işlemci genellikle anakarta lehimlidir ve donanımsal olarak yükseltilemez; bunun yerine RAM eklemek veya arka plan uygulamalarını azaltmak daha etkili olur.';
  }
  return '';
}

// RAM sürekli/kritik yüksekken, cihazın (Windows WMI üzerinden okunan) desteklediği
// azami RAM kapasitesini mevcut kurulu kapasiteyle karşılaştırıp somut bir yükseltme
// önerisi ya da "zaten azami kapasitede" bilgisini metne ekler.
function buildMemoryUpgradeNote(staticInfo, installedBytes) {
  const hw = staticInfo?.memoryHardware;
  if (!hw || !hw.maxCapacityBytes) return '';

  const installedGB = formatGB(installedBytes);
  const maxGB = formatGB(hw.maxCapacityBytes);
  const slotInfo = hw.slotsTotal != null ? ` (${hw.slotsUsed}/${hw.slotsTotal} slot dolu)` : '';

  if (hw.maxCapacityBytes - installedBytes > 1024 ** 3) {
    return ` Şu an ${installedGB} GB RAM kurulu; bu cihaz en fazla ${maxGB} GB RAM destekliyor${slotInfo}. RAM yükseltmek performansı belirgin şekilde artırabilir.`;
  }
  return ` Cihazınız zaten desteklediği azami RAM kapasitesinde (${maxGB} GB) çalışıyor; donanımsal RAM yükseltmesi mümkün değil, bunun yerine arka plan uygulamalarını azaltmayı deneyin.`;
}

function evaluateRecommendations(snapshot, recentHistory = [], staticInfo = null) {
  const recs = [];

  // --- CPU ---
  const recentCpuSamples = recentHistory
    .slice(-THRESHOLDS.cpuSustainedWindow)
    .map((p) => p.cpuPercent);
  const sustainedCpuAvg = average(recentCpuSamples);

  if (snapshot.cpu.loadPercent >= THRESHOLDS.cpuCriticalPercent) {
    recs.push({
      id: 'cpu-critical',
      severity: 'critical',
      title: 'CPU kullanımı çok yüksek',
      description: `CPU şu anda %${snapshot.cpu.loadPercent} kullanımda. Görev Yöneticisi'nden yoğun işlem yapan uygulamaları kontrol edin ve gerekiyorsa kapatın.${buildCpuUpgradeNote(staticInfo)}`,
    });
  } else if (
    recentCpuSamples.length >= THRESHOLDS.cpuSustainedWindow &&
    sustainedCpuAvg >= THRESHOLDS.cpuSustainedPercent
  ) {
    recs.push({
      id: 'cpu-sustained-high',
      severity: 'warning',
      title: 'CPU sürekli yüksek kullanımda',
      description: `Son bir dakikadır CPU kullanımı sürekli yüksek seyrediyor. Arka planda çalışan gereksiz uygulamaları veya başlangıç programlarını gözden geçirin.${buildCpuUpgradeNote(staticInfo)}`,
    });
  }

  if (snapshot.cpu.temperature != null) {
    if (snapshot.cpu.temperature >= THRESHOLDS.cpuTempCritical) {
      recs.push({
        id: 'cpu-temp-critical',
        severity: 'critical',
        title: 'İşlemci sıcaklığı kritik seviyede',
        description: `CPU sıcaklığı ${snapshot.cpu.temperature}°C. Laptobu düz ve sert bir zemine koyun, havalandırma deliklerinin kapalı olmadığından emin olun; gerekirse bir soğutma standı kullanın.`,
      });
    } else if (snapshot.cpu.temperature >= THRESHOLDS.cpuTempWarning) {
      recs.push({
        id: 'cpu-temp-warning',
        severity: 'warning',
        title: 'İşlemci sıcaklığı yüksek',
        description: `CPU sıcaklığı ${snapshot.cpu.temperature}°C. Fan ve havalandırma açıklıklarında toz birikimi olup olmadığını kontrol edin.`,
      });
    }
  }

  // --- Bellek (RAM) ---
  if (snapshot.memory.usedPercent >= THRESHOLDS.memCriticalPercent) {
    recs.push({
      id: 'mem-critical',
      severity: 'critical',
      title: 'Bellek (RAM) neredeyse dolu',
      description: `RAM kullanımı %${snapshot.memory.usedPercent}. Kullanılmayan sekme/uygulamaları kapatın.${buildMemoryUpgradeNote(staticInfo, snapshot.memory.totalBytes)}`,
    });
  } else if (snapshot.memory.usedPercent >= THRESHOLDS.memWarningPercent) {
    recs.push({
      id: 'mem-warning',
      severity: 'warning',
      title: 'Bellek kullanımı yüksek',
      description: `RAM kullanımı %${snapshot.memory.usedPercent}. Arka planda çok fazla sekme/uygulama açık olabilir.${buildMemoryUpgradeNote(staticInfo, snapshot.memory.totalBytes)}`,
    });
  }

  if (
    snapshot.memory.swapTotalBytes > 0 &&
    snapshot.memory.swapUsedBytes / snapshot.memory.swapTotalBytes > 0.3 &&
    snapshot.memory.usedPercent >= THRESHOLDS.memWarningPercent
  ) {
    recs.push({
      id: 'swap-high',
      severity: 'warning',
      title: 'Sanal bellek (sayfalama dosyası) yoğun kullanılıyor',
      description: 'Sistem disk üzerinden sanal belleğe yoğun şekilde başvuruyor, bu da performansı yavaşlatır. Bu genellikle yetersiz fiziksel RAM işaretidir.',
    });
  }

  // --- Disk ---
  const criticalVolumes = snapshot.disk.volumes.filter(
    (v) => v.usedPercent >= THRESHOLDS.diskCriticalPercent
  );
  const warningVolumes = snapshot.disk.volumes.filter(
    (v) =>
      v.usedPercent >= THRESHOLDS.diskWarningPercent &&
      v.usedPercent < THRESHOLDS.diskCriticalPercent
  );

  criticalVolumes.forEach((v) => {
    recs.push({
      id: `disk-critical-${v.mount}`,
      severity: 'critical',
      title: `Disk (${v.mount}) neredeyse dolu`,
      description: `${v.mount} bölümü %${v.usedPercent} dolu. Geçici dosyaları, indirilenler klasörünü ve kullanılmayan uygulamaları temizleyin.`,
    });
  });
  warningVolumes.forEach((v) => {
    recs.push({
      id: `disk-warning-${v.mount}`,
      severity: 'warning',
      title: `Disk (${v.mount}) doluyor`,
      description: `${v.mount} bölümü %${v.usedPercent} dolu. Disk temizliği yapmayı düşünün.`,
    });
  });

  // --- GPU ---
  snapshot.gpu.controllers.forEach((gpu, idx) => {
    if (gpu.temperature != null && gpu.temperature >= THRESHOLDS.gpuTempCritical) {
      recs.push({
        id: `gpu-temp-critical-${idx}`,
        severity: 'critical',
        title: 'Ekran kartı sıcaklığı kritik seviyede',
        description: `${gpu.model || 'GPU'} sıcaklığı ${gpu.temperature}°C. Ağır grafik uygulamalarını kapatın ve havalandırmayı kontrol edin.`,
      });
    } else if (gpu.temperature != null && gpu.temperature >= THRESHOLDS.gpuTempWarning) {
      recs.push({
        id: `gpu-temp-warning-${idx}`,
        severity: 'warning',
        title: 'Ekran kartı sıcaklığı yüksek',
        description: `${gpu.model || 'GPU'} sıcaklığı ${gpu.temperature}°C.`,
      });
    }
  });

  // --- Batarya ---
  if (snapshot.battery.hasBattery) {
    if (
      !snapshot.battery.isCharging &&
      !snapshot.battery.acConnected &&
      snapshot.battery.percent <= THRESHOLDS.batteryLowPercent
    ) {
      recs.push({
        id: 'battery-low',
        severity: 'critical',
        title: 'Batarya seviyesi düşük',
        description: `Batarya %${snapshot.battery.percent}. Veri kaybını önlemek için şarj cihazına bağlayın.`,
      });
    }

    const maxCap = snapshot.battery.maxCapacity;
    const designedCap = snapshot.battery.designedCapacity;
    if (maxCap && designedCap && designedCap > 0) {
      const healthPercent = (maxCap / designedCap) * 100;
      if (healthPercent < THRESHOLDS.batteryHealthWarningPercent) {
        recs.push({
          id: 'battery-health',
          severity: 'info',
          title: 'Batarya sağlığı zayıflamış',
          description: `Batarya kapasitesi tasarım kapasitesinin yaklaşık %${healthPercent.toFixed(0)}'i seviyesinde. Batarya değişimini değerlendirebilirsiniz.`,
        });
      }
    }

    if (
      snapshot.battery.cycleCount &&
      snapshot.battery.cycleCount >= THRESHOLDS.batteryCycleCountWarning
    ) {
      recs.push({
        id: 'battery-cycles',
        severity: 'info',
        title: 'Batarya şarj döngüsü yüksek',
        description: `Batarya ${snapshot.battery.cycleCount} şarj döngüsüne ulaştı. Zamanla kapasite kaybı normaldir.`,
      });
    }
  }

  recs.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return recs;
}

module.exports = { evaluateRecommendations, THRESHOLDS };
