# Photo to STL

Fotoğraftan 3D baskıya hazır **binary STL** üreten uçtan uca bir web uygulaması.
Kullanıcı bir veya birkaç fotoğraf yükler → sistem nesneyi arka plandan ayırır →
gerçek bir geometri hattıyla 3D mesh üretir → mesh'i temizler/onarır →
watertight/manifold gibi gerçek ölçümlerle doğrular → kullanıcı ölçek/birim
seçer → binary STL indirir.

**Bu ilk sürümde hiçbir adım simüle edilmemiştir.** Arka plan ayrıştırma gerçek
bir ONNX ağıyla (U²-Net), 3D geometri gerçek bir çok-görünümlü siluet kesişimi
(visual hull) algoritmasıyla, mesh temizleme gerçek `trimesh`/`pymeshfix`
işlemleriyle, watertight/manifold/self-intersection kontrolleri gerçek
topoloji/geometri testleriyle yapılır. "Loading..." arkasında sahte ilerleme
yoktur; her adımın süresi işin büyüklüğüne göre gerçekten değişir.

---

## 1. Hızlı başlangıç

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --reload --port 8000

# Frontend (ayrı terminalde)
cd frontend
npm install
npm run dev    # http://localhost:5173  (Vite dev-server /api isteklerini 8000'e proxy'ler)
```

Tarayıcıda `http://localhost:5173` açılır. İlk çalıştırmada arka plan
ayrıştırma modeli (~4.5 MB, U²-Net'in hafif sürümü `u2netp`) otomatik olarak
indirilir ve `~/.u2net` altında önbelleğe alınır.

Uçtan uca gerçek pipeline testi (sentetik ama bağımsız üretilmiş fotoğraflarla,
hiçbir adım mock'lanmadan):

```bash
cd backend && source .venv/bin/activate
PYTHONPATH=. python tests/test_pipeline_e2e.py
```

---

## 2. Image-to-3D teknoloji araştırması (2026)

Projeye başlamadan önce güncel image-to-3D seçenekleri değerlendirildi:

| Yöntem | Tip | Tek foto | Çoklu foto | Hız (CPU) | Maliyet | Lisans/Erişim | STL/mesh çıktısı |
|---|---|---|---|---|---|---|---|
| **TripoSR / InstantMesh / Wonder3D** | Açık kaynak, feed-forward diffusion/transformer | İyi (tek foto) | Sınırlı çok-view desteği | Pratik değil (GPU gerektirir, model ağırlıkları GB seviyesinde) | Ücretsiz (ağırlıklar) | Çoğu Apache/MIT, ağırlıklar Hugging Face üzerinden | Mesh (genelde temizlik gerektirir) |
| **Tripo AI / Meshy / Rodin (Hyper3D) API** | Ticari, bulut tabanlı | Çok iyi | Çok iyi (multi-image mod) | Hızlı (sunucu tarafı) | Kullanım başına ücretli (kredi sistemi) | Kapalı kaynak API, key gerekli | STL/GLB doğrudan |
| **Zero-1-to-3 / Shap-E** | Açık kaynak, eski nesil | Orta | Zayıf | Pratik değil (GPU) | Ücretsiz | MIT/Apache | Mesh |
| **Shape-from-Silhouette / Visual Hull** (klasik CV) | Klasik geometri, öğrenme gerektirmez | Zayıf (tek fotoda derinlik bilgisi yok) | **İyi** (3-6 görünümle) | Çok hızlı (CPU, saniyeler) | Ücretsiz, yerel | Kısıtlama yok | Doğrudan mesh (marching cubes) |

**Bu ortamdaki somut kısıtlama:** Çalıştığımız sandbox ortamının ağ politikası
yalnızca `pypi.org`, `npmjs.org`, `crates.io`, `proxy.golang.org` ve GitHub
release/asset indirmelerine (`github.com`, `raw.githubusercontent.com`,
`objects.githubusercontent.com`) izin veriyor; **`huggingface.co` ve
`download.pytorch.org` engelli**. Bu, TripoSR/InstantMesh gibi açık kaynak
sinir ağı modellerinin ağırlıklarının (genelde Hugging Face Hub'dan dağıtılır)
bu ortamda indirilemeyeceği anlamına geliyor. Ayrıca hiçbir ticari
Image-to-3D API anahtarı (Tripo/Meshy/Rodin/Stability) sağlanmadı.

*(Doğrulama notu: `rembg`'nin U²-Net ağırlıkları GitHub release asset'i
olduğu için bu ortamda indirilebiliyor — bu yüzden arka plan ayrıştırma gerçek
bir sinir ağıyla çalışıyor. `torch` + `torch.hub` üzerinden MiDaS derinlik
tahmini de denendi; `torch` paketi PyPI'den kurulabiliyor ama CUDA
bağımlılıklarıyla birlikte ~5.5 GB'a çıkıyor ve `torch.hub.load` GitHub'dan
model kodunu çekmeye çalışırken 400 hatası aldı. Bu deneme kaldırıldı; ağırlık
indirmenin mümkün olduğu ama pratik/güvenilir olmadığı görüldü.)*

**Karar:** Bu ilk sürüm, **klasik ama gerçek** bir geometri hattı kullanır:

- **Çoklu fotoğraf (2-6 görünüm):** *Shape-from-Silhouette / Visual Hull*
  (Laurentini, 1994) — her fotoğrafın siluetinden bir "görüş konisi" tanımlanır,
  bu konilerin kesişimi voksel uzayında hesaplanır (voxel carving), marching
  cubes ile yüzey çıkarılır. Görünmeyen içbükey detaylar (oyuklar, kabartmalar)
  bu yöntemle **matematiksel olarak** yakalanamaz — bu bir uygulama eksikliği
  değil, yöntemin doğasıdır ve arayüzde açıkça belirtilir.
- **Tek fotoğraf:** *Siluet şişirme (silhouette inflation)* — ölçülen 2D
  siluetin mesafe dönüşümünden (distance transform) simetrik bir "yastık"
  şeklinde 3D'ye şişirilmesi. Görünen dış hat gerçektir; derinlik **tahmindir**
  ve arayüzde "düşük güven" olarak açıkça işaretlenir.

Mimari, `ImageTo3DProvider` arayüzü (`backend/app/pipeline/reconstruction/`)
etrafında kurulmuştur: bir API anahtarı veya GPU'lu bir ortam mevcut olduğunda,
`registry.py`'ye yeni bir provider eklemek yeterlidir — geri kalan hiçbir kod
(API route'ları, job orkestratörü, frontend) değişmez. `app/config.py` zaten
`PTS_TRIPO_API_KEY` / `PTS_MESHY_API_KEY` / `PTS_RODIN_API_KEY` /
`PTS_STABILITY_API_KEY` ortam değişkenlerini okuyacak şekilde hazır; bunlar
sağlandığında `registry.py`'deki `pick_provider()` fonksiyonuna birkaç satırla
yeni bir dal eklenip o sağlayıcı devreye alınabilir.

---

## 3. Mimari

```
frontend/  React + TypeScript + Vite + three.js (@react-three/fiber, drei)
backend/   FastAPI (Python)
  app/pipeline/
    image_quality.py        Bulanıklık / ışık / arka plan karmaşıklığı (OpenCV, gerçek piksel istatistikleri)
    segmentation.py         rembg (U²-Net, ONNX Runtime) + GrabCut fallback
    reconstruction/
      provider_base.py      ImageTo3DProvider arayüzü
      visual_hull.py         Çoklu görünüm voxel carving + marching cubes (scikit-image)
      silhouette_inflate.py  Tek görünüm siluet şişirme
      registry.py            Hangi provider kullanılacağına karar verir
    mesh_cleanup.py         trimesh + pymeshfix + fast-simplification (15 adımlık temizlik)
    mesh_diagnostics.py     watertight/manifold/self-intersection gerçek ölçümü
    printability.py         Duvar kalınlığı (trimesh.proximity.thickness) + baskı uyarıları
    stl_export.py           Ölçekleme, binary STL + GLB export
    orchestrator.py         Job'ı adım adım yürütür, gerçek zamanlı durum günceller
  app/api/                  upload / reconstruct / jobs / models (+repair/export/delete)
  app/core/                 Job store, geçici dosya depolama + TTL temizleyici
```

### API uç noktaları

| Method | Path | Açıklama |
|---|---|---|
| POST | `/api/upload` | Fotoğraf(lar)ı yükler, her biri için gerçek kalite analizi döner |
| POST | `/api/reconstruct` | Job başlatır (kalite modu, mesh yoğunluğu, model adı) |
| GET | `/api/jobs/{id}` | Job'ın adım adım gerçek durumunu döner (polling) |
| GET | `/api/models/{id}` | Model meta verisi, tanı (diagnostics), baskı uygunluğu |
| GET | `/api/models/{id}/preview.glb` | Three.js önizlemesi için GLB |
| GET | `/api/models/{id}/download` | Binary STL indirme |
| POST | `/api/models/{id}/repair` | Daha agresif ayarlarla yeniden onarım dener |
| POST | `/api/models/{id}/export` | Yeni ölçek/birim/nozzle ile STL'i yeniden üretir |
| DELETE | `/api/models/{id}` | Modeli ve geçici dosyalarını siler |

---

## 4. Mesh temizleme hattı (15 adım)

`mesh_cleanup.py` + `mesh_diagnostics.py`, brief'te istenen sırayla çalışır:
import → ölçek normalizasyonu → uçuşan parça temizliği → tekrarlı
vertex/yüzey temizliği → normal düzeltme → dejenere üçgen temizliği →
**pymeshfix** ile non-manifold onarımı ve delik doldurma → Taubin
düzleştirme (hacmi koruyan, Laplacian'ın aksine büzülme yapmayan yöntem) →
**fast-simplification** ile hedef yoğunluğa sadeleştirme → ikinci bir
pymeshfix geçişi (düzleştirme/sadeleştirme yeni sorun yaratmışsa) →
watertight/manifold/self-intersection gerçek ölçümü → binary STL export.

Self-intersection testi, `rtree` tabanlı geniş-faz (bounding box) taraması ile
adayları daraltıp, her aday çift için tam bir ayıran-eksen (SAT) üçgen-üçgen
kesişim testi uygular — yaklaşık/"tahmini" değil, gerçek bir geometrik testtir.

**Dürüstlük ilkesi:** `is_stl_ready` yalnızca watertight + manifold + tutarlı
normal + sıfır self-intersection **gerçekten** doğrulandığında `true` olur.
Sentetik test nesnesi gibi keskin, içbükey geçişleri olan şekillerde otomatik
onarımdan sonra bile küçük bir self-intersection kalabilir — sistem bunu
"Watertight ✓" diye gizlemez, tam sayısıyla raporlar ve
"Otomatik düzeltmeyi dene" butonuyla ikinci bir onarım turu sunar.

---

## 5. Dürüstlük / bilinen sınırlamalar

- **Tek fotoğraf:** Görünmeyen arka yüzey **geometrik bir tahmindir**, ölçüm
  değildir. Arayüzde "düşük güven" rozeti ve açık uyarı metniyle gösterilir.
- **Visual hull (çoklu görünüm):** İçbükey detaylar (oyuklar, kabartmalar)
  matematiksel olarak yakalanamaz; bu her silüet-kesişim yönteminin doğasıdır.
- **Kamera kalibrasyonu yok:** Fotoğrafların ortalama benzer şekilde
  çerçevelendiği varsayılır (kalibre edilmemiş amatör çekim senaryosu).
  Etiketlenmemiş çoklu fotoğraflar dönen-masa (eşit açı) varsayımıyla işlenir.
- **Duvar kalınlığı / self-intersection** gerçek geometrik ölçümlerdir ancak
  yoğun mesh'lerde hesaplama maliyeti nedeniyle örneklenerek (sampling)
  yapılır; bu durum yanıtta `self_intersection_check_method` alanında açıkça
  belirtilir.
- **Kalıcı depolama yok:** Yüklenen fotoğraflar ve üretilen modeller
  `PTS_UPLOAD_TTL_MINUTES` (varsayılan 120 dk) sonra otomatik silinir.

---

## 6. Yol haritası

- Kullanıcı hesabı, model geçmişi, kredi sistemi: `app/core/jobs.py`
  şu an process-içi bellekte tek bir `JobStore`; bir veritabanı (ör. Postgres)
  ve kimlik doğrulama katmanı eklemek, route'ların geri kalanını etkilemeden
  bu modülün arkasına yerleştirilebilir.
- Çoklu worker / ölçekleme: `routes_reconstruct.py` şu an işi
  `run_in_executor` ile aynı process içinde bir thread'de çalıştırır; yüksek
  trafikte Celery/RQ + Redis kuyruğuna taşımak, `orchestrator.run_job`
  imzasını değiştirmeden yapılabilir.
- Nöral/ticari Image-to-3D sağlayıcı: `ImageTo3DProvider` arayüzünü
  uygulayan yeni bir sınıf + `registry.py`'de bir satır.
