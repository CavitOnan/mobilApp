# Laptop Perf Monitoring

Windows için, laptop performansını (CPU, RAM, disk, GPU, batarya, ağ) canlı olarak izleyen ve
tespit ettiği sorunlara göre öneriler sunan bir masaüstü uygulaması.

## Özellikler

- CPU, RAM, disk, GPU, batarya ve ağ kullanımını 2 saniyede bir izler
- Son 5 dakikalık canlı grafik + 24 saatlik geçmiş (diskte saklanır, uygulama kapansa da kalır)
- Kural tabanlı öneri motoru: yüksek CPU/RAM/disk kullanımı, yüksek sıcaklık, düşük/zayıflamış
  batarya gibi durumlarda somut öneriler üretir
- Sistem tepsisinde (system tray) çalışır; pencere kapatılınca uygulama arka planda izlemeye
  devam eder, tepsi simgesinden tekrar açılabilir
- Kritik durumlarda (örn. RAM %90 üstü, disk dolmak üzere) Windows bildirimi gösterir

## Teknoloji

- **Electron** — masaüstü uygulama kabuğu, sistem tepsisi ve bildirimler
- **React + Vite** — arayüz
- **systeminformation** — donanım/performans verisi toplama
- **recharts** — geçmiş grafikleri
- **electron-store** — geçmiş verinin diske kalıcı olarak yazılması

## Proje yapısı

```
electron/
  main.js               # Electron ana süreç: pencere, tray, IPC
  preload.js             # Renderer'a güvenli köprü (contextBridge)
  metrics/
    collector.js          # systeminformation ile periyodik veri toplama
    history.js             # Canlı + kalıcı geçmiş veri yönetimi
    recommendations.js     # Kural tabanlı öneri motoru
  assets/                 # Uygulama/tray ikonları
src/
  main.jsx, App.jsx        # React giriş noktası ve ana ekran
  components/               # Metrik kartları, grafik, öneri paneli
  utils/format.js            # Birim/format yardımcıları
scripts/generate-icons.js  # Placeholder ikonları üreten yardımcı script
```

## Geliştirme

```bash
npm install
npm run dev
```

Bu komut Vite geliştirme sunucusunu ve Electron'u birlikte başlatır (hot reload ile).

## Windows için paketleme (.exe)

```bash
npm run dist:win
```

Çıktı `release/` klasöründe NSIS kurulum dosyası (`.exe`) olarak oluşur.

> Not: `build/icon.png` ve `electron/assets/*.png` şu an `scripts/generate-icons.js` ile
> üretilmiş basit birer placeholder ikondur. Gerçek bir uygulama ikonu ile değiştirmek için
> aynı dosya adlarını 256x256 (build/icon.png) ve 32x32 (electron/assets/tray-icon.png) PNG
> dosyalarıyla değiştirmeniz yeterli.

## Öneri motorunu ayarlama

Eşik değerleri `electron/metrics/recommendations.js` içindeki `THRESHOLDS` nesnesinden
değiştirilebilir (örn. RAM uyarı eşiğini %80'den farklı bir değere çekmek gibi).

## Bilinen sınırlamalar

- CPU/GPU sıcaklık okuma değerleri donanım/sürücüye bağlı olarak bazı sistemlerde `null`
  dönebilir (systeminformation'ın desteklediği sensörlerle sınırlıdır).
- Bu proje Linux tabanlı bir geliştirme ortamında yazılmıştır; gerçek Windows donanım
  sensörleriyle (batarya sağlığı, sıcaklık) son doğrulama gerçek bir Windows makinesinde
  yapılmalıdır.
