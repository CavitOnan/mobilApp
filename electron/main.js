const path = require('path');
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification } = require('electron');

const { startCollector, collectStaticInfo } = require('./metrics/collector');
const { HistoryStore } = require('./metrics/history');
const { evaluateRecommendations } = require('./metrics/recommendations');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;
let tray = null;
let isQuitting = false;
let stopCollector = null;
const historyStore = new HistoryStore();
let notifiedCriticalIds = new Set();
let staticInfoCache = null;
let staticInfoPromise = null;

// Donanım bilgisi (CPU modeli, RAM slot/azami kapasite vb.) neredeyse hiç değişmez
// ve WMI sorgusu (RAM azami kapasitesi için) yüzlerce ms sürebilir; bu yüzden bir kez
// alınıp önbelleğe alınır, her metrik döngüsünde yeniden sorgulanmaz.
function getStaticInfo() {
  if (staticInfoCache) return Promise.resolve(staticInfoCache);
  if (!staticInfoPromise) {
    staticInfoPromise = collectStaticInfo()
      .then((info) => {
        staticInfoCache = info;
        return info;
      })
      .catch((err) => {
        console.error('[main] statik sistem bilgisi alınamadı:', err);
        staticInfoPromise = null;
        return null;
      });
  }
  return staticInfoPromise;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 820,
    minHeight: 560,
    icon: path.join(__dirname, 'assets', 'app-icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray-icon.png'));
  tray = new Tray(icon);
  tray.setToolTip('Laptop Perf Monitoring');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Göster',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Çıkış',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function notifyCriticalRecommendations(recs) {
  const currentCriticalIds = new Set(recs.filter((r) => r.severity === 'critical').map((r) => r.id));

  for (const rec of recs) {
    if (rec.severity === 'critical' && !notifiedCriticalIds.has(rec.id)) {
      if (Notification.isSupported()) {
        new Notification({
          title: rec.title,
          body: rec.description,
          icon: path.join(__dirname, 'assets', 'app-icon.png'),
        }).show();
      }
    }
  }

  notifiedCriticalIds = currentCriticalIds;
}

function startMonitoring() {
  stopCollector = startCollector((snapshot) => {
    const point = historyStore.addSnapshot(snapshot);
    const recentHistory = historyStore.getAll().live;
    const recommendations = evaluateRecommendations(snapshot, recentHistory, staticInfoCache);

    if (tray) {
      tray.setToolTip(
        `Laptop Perf Monitoring\nCPU: %${snapshot.cpu.loadPercent}  RAM: %${snapshot.memory.usedPercent}`
      );
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('metrics:update', snapshot);
      mainWindow.webContents.send('recommendations:update', recommendations);
    }

    notifyCriticalRecommendations(recommendations);
    void point;
  });
}

ipcMain.handle('history:get', () => historyStore.getAll());
ipcMain.handle('system:static-info', () => getStaticInfo());
ipcMain.on('window:minimize-to-tray', () => {
  if (mainWindow) mainWindow.hide();
});
ipcMain.on('app:quit', () => {
  isQuitting = true;
  app.quit();
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  getStaticInfo();
  startMonitoring();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  // Uygulama sistem tepsisinde çalışmaya devam eder; sadece "Çıkış" ile kapanır.
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (stopCollector) stopCollector();
});
