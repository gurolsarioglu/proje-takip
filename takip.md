# Proje Geliştirme ve Takip Dokümanı (takip.md)

Bu doküman, proje boyunca alınan kararları, geliştirilen özellikleri, mimari yapıyı ve yapılacak işleri adım adım takip etmek için oluşturulmuştur. Her yeni işlemde güncellenir.

---

## 1. Belirlenen Temel Kurallar ve İlkeler

1. **İş Takibi ve Şeffaflık:** Yapılan her geliştirme, mimari karar ve durum güncellemesi `takip.md` dokümanına anlık olarak işlenir.
2. **Clean Code & Yüksek Performans:** Kodlar kısa, az karmaşık, okunabilir, temiz (Clean Code) ve yüksek performanslı olacaktır.
3. **MVC Modeli ve Katmanlı Mimari:** 
   * **Model:** Veri varlıkları, kurallar ve veri erişim katmanı.
   * **Controller:** İstemci isteklerini doğrulayan ve ilgili servislere yönlendiren katman.
   * **View / UI:** Kullanıcı dostu, modern, yalın ve yetkiye göre şekillenen ekranlar.
4. **Sade ve Sezgisel Proje Deneyimi (OpenProject Sadeleştirmesi):**
   * Karmaşık matematiksel formüller, DAG terimleri ve teknik paneller son kullanıcının gözünden gizlenir; arka planda sessizce çalışır.
   * Kullanıcı için sol menülü (Sidebar), modern, sade ve akıcı bir arayüz sunulur:
     - 📁 **Projelerim:** Şirketin projeleri ve ilerleme çubuğu.
     - 📋 **Görevlerim:** Giriş yapan personelin doğrudan kendi yapacağı işler.
     - 📅 **Zaman Çizelgesi (Gantt):** Görevlerin takvim barları ve kim kimi bekliyor akışı.
     - 📊 **Pano (Kanban):** Yapılacak, Sürüyor, Tamamlandı.
     - 👥 **Ekip / Personel:** Admin için sade personel kartları.
5. **Admin Kontrollü Kullanıcı ve Personel Kartı Yönetimi:**
   * Kullanıcıların giriş bilgileri (hesapları, şifreleri) **Admin** tarafından açılır.
   * Varsayılan Admin: `admin@fggroup.com.tr` / `123`.
   * Personel Kartı alanları: Ad Soyad, E-posta, Cep Telefonu, Bulunduğu Ülke, Dil, Şifre, Proje Açma Yetkisi (`can_create_project`).
6. **Ülkeye Göre Otomatik Dil Seçimi (i18n):**
   * Personelin ülkesine göre arayüz dili (TR, EN, DE) otomatik eşleşir.
7. **Otomatik GitHub Senkronizasyonu:**
   * Yapılan her değişiklik, geliştirme ve mimari adım sonunda kullanıcıya sormadan `git commit` edilecek ve `https://github.com/gurolsarioglu/proje-takip.git` reposuna `git push` yapılacaktır.

---

## 2. Kullanıcı Rol ve Yetki Matrisi

| Rol / Yetki | Kendi Görevlerini Yapma | Yeni Proje Açma | Başkalarına Görev Atama | Personel Kartı & Kullanıcı Yönetimi |
| :--- | :---: | :---: | :---: | :---: |
| **Sistem Yöneticisi (Admin)** | Evet | Evet | Evet | Evet (Tam Yetki) |
| **Proje Yöneticisi / Yetkili Personel** (`can_create_project = true`) | Evet | Evet | Evet | Hayır |
| **Standart Personel** (`can_create_project = false`) | Evet (Yalnızca Kendisine Atananlar) | Hayır | Hayır | Hayır |

---

## 3. Yol Haritası ve Yapılacaklar (Sprint / Backlog)

- [x] **Adım 1:** Temel kuralların belirlenmesi ve `takip.md` oluşturulması.
- [x] **Adım 2:** Personel Kartı veri modeli ve Admin hesap bilgilerinin (`admin@fggroup.com.tr` / `123`) planlanması.
- [x] **Adım 3:** Backend Model & Controller Güncellemesi:
  - `User` modeline Personel Kartı alanlarının eklenmesi (`phone`, `country`, `password`, `language`, `role`, `can_create_project`).
  - Auth Service: E-posta + Şifre ile Login doğrulama (`/api/auth/login`).
  - Admin Controller: Personel kartı API'leri (`/api/admin/personnel`).
  - Ülkeye göre otomatik dil seçimi motoru (`tr`, `en`, `de`).
  - Proje açma izni (`can_create_project`) kontrolü.
- [x] **Adım 4:** OpenProject Esintili Sadeleştirilmiş Yeni Arayüz:
  - Sol Menü (Sidebar) düzeni: Projelerim, Görevlerim, Zaman Çizelgesi (Gantt), Pano, Ekip.
  - Basitleştirilmiş Görev ve Bağımlılık Seçimi ("Neyi Bekliyor?").
  - Görsel Zaman Çizelgesi (Gantt Çubukları ve Bağlantılar).
  - Sadeleştirilmiş dil kullanımı (DAG/matematik terimlerinden arındırılmış).
- [x] **Adım 5:** Testler ve Tarayıcı Doğrulaması:
  - 14/14 Birim & Kabul Testi tamamlandı (`npm test` başarıyla geçti).
  - Tarayıcı alt ajanı ile Admin ve Hans (Almanya - DE) girişleri, menü geçişleri ve yetki kısıtları doğrulandı.
- [x] **Adım 6:** OpenProject Entegrasyonu & İşlevsel/Görsel Adaptasyon:
  - OpenProject repo incelemesi: Work Packages, Split Screen (Sağ Detay Çekmecesi), Primer Design System özellikleri uyarlandı.
  - **Sağ Detay Çekmecesi (Split Screen):** Göreve tıklandığında sayfa yenilenmeden sağdan açılan detay paneli (ID, Tür, Durum, Personel Kartı, Öncül/Ardıl İlişkileri, Gecikme Açıklama Akışı).
  - **İş Paketi Filtre & Canlı Arama:** Metin arama, proje ve durum filtreleme çubuğu.
- [x] **Adım 7:** Kullanıcı Talepleri (istekler/1.jpg & 2.jpeg):
  - **X Ekseni Gün Takvimi:** Ay isimleri ve gün numaraları (1, 2, ... 31) x ekseninde sütunlar olarak gösterildi.
  - **Tarih Formatı:** Barların içindeki tarihler `GG.AA.YYYY` formatında yazıldı.
  - **Ok İşareti ile Bağımlılık Bağlantısı (Resim 2 Örneği):** Öncül görevden ardıl göreve giden kavisli SVG ok çizgisi ile görevler birbirine bağlandı (başlangıç noktası ve altın ok ucu).
  - **Gantt İçi Görev Kartları:** İlerleme yüzdesi, durum rozeti ve görev türü etiketleriyle modern görünüm sağlandı.
- [x] **Adım 8:** Tarayıcı Testleri ve Canlı Onay:
- [x] **Adım 11:** İnteraktif Kanban Panosu (Sürükle-Bırak, Canlı Arama ve DAG Bağımlılık Koruması):
  - HTML5 Drag & Drop ile kartları sütunlar (Yapılacak ➔ Devam Ediyor ➔ Tamamlandı) arasında sürükleyip bırakarak canlı durum güncelleme.
  - Şartname v0.3 DAG Bağımlılık Koruması: Öncülleri tamamlanmamış `BLOCKED` görevlerin `IN_PROGRESS` veya `COMPLETED` sütununa taşınması engellendi; kart sallama animasyonu ve net uyarı mesajı gösterildi.
  - Anlık Görev & Kişi Arama: Kanban üst barındaki canlı arama kutusu ile filtreleme.
  - 17/17 Birim & Kabul Testi eksiksiz geçti (`npm test`).
  - Tarayıcı alt ajanı ile canlı test edilip ekran görüntüsü alındı.
- [x] **Adım 12:** Excel / CSV Dışa Aktarma & Proje İçe Aktarma (Import / Export):
  - **Excel (CSV) Dışa Aktar:** UTF-8 BOM ile Microsoft Excel'de doğrudan Türkçe karakterlerle açılan noktalı virgüllü (;) görev listesi indirme.
  - **JSON Proje Yedeği:** Proje, görevler ve bağımlılıkların tam yapısal JSON yedeği.
  - **Sayfayı Yazdır / PDF:** A4 formatına duyarlı `@media print` temiz sayfa çıktısı.
  - **CSV İle Toplu Görev İçe Aktar (Import):**
    - Örnek şablon indirme (`ornek_gorev_sablonu.csv`).
    - Dosya seçme ve sürükle-bırak dropzone alanı.
    - Canlı ayrıştırma (virgül veya noktalı virgül otomatik tespiti) ve önizleme tablosu.
    - Backend `POST /api/projects/:id/tasks/bulk` ve `TaskService.bulkCreateTasks` entegrasyonu.
  - 18/18 Birim & Kabul Testi eksiksiz geçti (`npm test`).
  - Tarayıcı alt ajanı ile canlı test edilip ekran görüntüsü alındı.

---

## 4. Değişiklik ve Karar Günlüğü (Changelog)

### [23 Ekim 2026 - 16:05] - Karar: Microsoft To Do Entegrasyonu İleri Tarihe Ertelendi
* **Kullanıcı Kararı:** "Şu an yapmayalım, sonra yaparız, değerlendiririz." kararı doğrultusunda canlı Outlook / To Do entegrasyonu beklemeye alındı.
* **Arayüz Sadeleştirme:** Sol menüdeki Microsoft To Do butonu gizlendi; çalışma alanı yalın ve odaklanmış hale getirildi.
* **Altyapı:** Yazılan servis ve model kodları silinmedi, ileride ihtiyaç duyulduğunda hızlıca açılabilecek şekilde hazır bekletiliyor.

### [23 Ekim 2026 - 16:00] - Microsoft To Do Canlı Bağlantı Analizi & Dürüst Durum Güncellemesi
* **Kullanıcı Geri Bildirimi & Durum Tespiti:**
  - Kullanıcı masaüstündeki gerçek Outlook To Do uygulamasını açtığında görevlerin otomatik oraya yansımadığını haklı olarak iletti.
  - Yapılan teknik incelemede: Uygulama içindeki arayüzün ve yerel veritabanının çalıştığı, ancak **gerçek Microsoft 365 / Exchange bulutuna canlı erişim için Azure App Registration (Entra ID) kimlik doğrulaması gerektiği** netleştirildi.
* **Arayüz Düzeltmesi:**
  - Yanıltıcı olabilecek *"Bağlantı aktif"* rozeti kaldırıldı.
  - Durum: `🔴 Canlı Microsoft 365 Bağlantısı Yapılandırılmadı (Yerel Mod)` olarak güncellendi.
  - Ekranın üstüne neden canlı eşleşmediğini açıklayan bilgilendirme kutusu (`ms-connection-alert-box`) ve canlı bağlantıyı kurmak için gerekli `⚙️ Azure / 365 Canlı Bağlantı Ayarları` modalı eklendi.
* **Canlı Bağlantı İçin Gereksinimler:**
  1. `portal.azure.com` üzerinden App Registration oluşturulması.
  2. `Microsoft Graph ➔ Tasks.ReadWrite` izni tanımlanması.
  3. Tenant ID ve Client ID bilgilerinin girilmesi.

### [23 Ekim 2026 - 15:05] - Admin Rapor Yetkilendirmesi & Sürükle-Bırak Rapor Oluşturucu Tamamlandı
* **Admin Personel Yetkilendirme (`can_build_reports`):**
  - Personel tablosuna `Proje Yetkisi` ve `Rapor Yetkisi` sütunları eklendi.
  - Admin kullanıcılar istedikleri personele tek tıkla veya personel kartı düzenleme modalından "Rapor Yetkisi" verebilir/kaldırabilir.
  - Yetkisiz personel sisteme girdiğinde Özel Raporlar sekmesini göremez; API seviyesinde 403 Forbidden kontrolü uygulanır.
* **Sürükle - Bırak (Drag & Drop) Tuvali:**
  - HTML5 Drag & Drop ve interaktif `+` butonları ile tuvale widget ekleme, genişlik değiştirme (Tam/Yarım) ve silme özellikleri eklendi.
  - **8 Bileşen:**
    1. 📊 Proje İlerleme & KPI Özeti
    2. 👥 Personel Performans Tablosu (Şartname v0.3 puanı `100 * (0.70*Z + 0.30*T)`)
    3. 📈 Görev Durum Dağılım Grafiği
    4. ⏳ Kritik Yol & Geciken Görevler Listesi
    5. 🔗 Bağımlılık & Darboğaz Akışı
    6. 📝 Gecikme Gerekçeleri & Açıklama Günlüğü
    7. 🎯 Proje Kilometre Taşları (Milestones)
    8. ✍️ Yönetici Notu & Değerlendirme Serbest Kartı
* **Hazır Şablonlar & PDF / Baskı Desteği:**
  - Tek tıkla "Yönetici Özeti", "Personel Performans Karnesi", "Darboğaz Analizi" şablonları yüklenebilir.
  - A4 baskı ve PDF formatına uygun `@media print` CSS kuralları uygulandı.
* **15/15 Kabul Testi Geçti:** Tüm birim ve kabul testleri eksiksiz geçmektedir.

### [23 Ekim 2026 - 15:30] - Microsoft To Do Çift Yönlü Entegrasyon Altyapısı
* **Çift Yönlü Senkronizasyon Mimarisi (`src/server/integrations/microsoftTodo.ts`):**
  - Tenant kullanıcılarının Outlook / Microsoft To Do hesaplarındaki görevleri ve projede kendilerine atanan görevleri eşitleyen servis katmanı kuruldu.
  - Açıklama, not ve durum güncellemelerinin çift yönlü (Two-Way) senkronizasyon mantığı hazırlandı.
  - Şartname ve kabul testlerine `MICROSOFT TO DO: Çift yönlü görev senkronizasyonu` testi eklendi (16/16 test başarılı).
  - Kullanıcı isteği doğrultusunda canlı prodüksiyon OAuth2 bağlantısı beklemeye alındı, altyapı hazırlandı.

### [23 Ekim 2026 - 16:15] - Premium Executive Beyaz Tema & Tipografi Dönüşümü (Plus Jakarta Sans)
* **Tasarım Vizyonu & Felsefesi:**
  - Koyu, neon ve yapay zeka jenerik şablon hissi veren koyu tema terk edildi; yerine Linear, Stripe, Apple ve modern OpenProject standartlarında "Executive White" ışıl ışıl beyaz kurumsal arayüz inşa edildi.
* **Tipografi & Yazı Fontları:**
  - Modern kurumsal SaaS standartlarında Google Fonts'tan **Plus Jakarta Sans** (400, 500, 600, 700, 800) ve teknik/metrik alanlar için **JetBrains Mono** entegre edildi.
  - Tüm başlıklar, kartlar, tablolar ve butonlar bu tipografi hiyerarşisiyle yeniden biçimlendirildi.
* **Renk Paleti & Işık Dengesi:**
  - Gövde arka planı: Soft pürüzsüz açık gri-beyaz (`#f8fafc`).
  - Yan menü (Sidebar) & Üst başlık (Header): Saf beyaz (`#ffffff`), 1px ince saten kenarlık (`#e2e8f0`).
  - Kartlar & Tablolar: Derinlik veren mikro gölgeli beyaz zemin (`#ffffff`, `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05)`).
  - Yazı Rengi: Okunaklı, göz yormayan derin obsidian-arduvaz (`#0f172a`, ikincil `#334155`, üçüncül `#64748b`).
  - Vurgu & Aksiyon: Kurumsal safir mavisi (`#2563eb`), zümrüt yeşili (`#059669`), amber sarısı (`#d97706`).
* **Korunan & Kusursuzlaşan Bileşenler:**
  - **İş Paketleri Tablosu**: Açık temada Stripe netliğinde grid çizgileri ve durum rozetleri.
  - **Gantt Şeması**: Günlük takvim hücreleri, pürüzsüz satır çizgileri ve dinamik altın bağımlılık okları.
  - **Kanban Panosu**: Açık gri sütunlar, beyaz görev kartları, sürükle-bırak göstergeleri.
  - **OpenProject Split-Screen**: Sağdan açılan görev inceleme ve düzenleme çekmecesi.
  - **Özel Raporlar Tuvali**: Sürükle-bırak rapor bileşenleri, KPI kartları ve baskı önizleme.
  - **Ekip & Personel Yönetimi**: Ülke bayrakları, telefon/e-posta ve yetkilendirme rozetleri.
* **Test & Doğrulama:**
  - 16/16 kabul testi eksiksiz geçti (`npm test`).
  - Tarayıcı alt ajanı ile tüm sekmeler gerçek zamanlı olarak test edildi ve ekran görüntüleri doğrulandı.

### [23 Ekim 2026 - 16:30] - Arka Zemin Rengi Düzeltmesi & Gantt Bar Kontrast İyileştirmesi
* **Kök Neden Tespiti:**
  - `body` stilinde kalan koyu navy (`#0f172a`) zemin rengi ve `.app-main-area` / `.view-section` kapsayıcılarının zemin rengi almaması nedeniyle kartların etrafındaki alanlar koyu görünüyordu.
  - Ayrıca tamamlanan görevlerin koyu gri (`#64748b`) rengi ve beyaz tarih yazısı kontrast kaybına neden oluyordu.
* **Uygulanan Düzeltmeler:**
  - `html`, `body`, `.app-wrapper`, `.app-main-area` ve `.view-section` zeminleri tamamen homojen, göz yormayan açık gri-beyaz (`#f8fafc`) yapıldı.
  - Gantt barlarında tamamlanan görevler canlı ve kurumsal zümrüt yeşili degradeye (`linear-gradient(135deg, #059669, #047857)`), tarih ve ilerleme rozetleri kontrastlı yarı saydam kapsüllere kavuşturuldu.
  - `.report-builder-header` ve `.op-split-drawer` zeminleri saf beyaz (`#ffffff`) yapıldı.
* **Test & Doğrulama:**
  - Tarayıcı alt ajanı ile Gantt, İş Paketleri ve Kanban sayfalarının tam sayfa ekran görüntüleri alındı, koyu zemin sorununun tamamen ortadan kalktığı doğrulandı.
  - 16/16 test başarıyla geçti.



### [2 Kasım 2026 - 16:00] - Exchange Online Plan 1 (SMTP), Outlook Actionable Messages (Adaptive Cards v1.4) & Zamanlanmış Otomatik Raporlar Merkezi
* **Admin E-Posta (SMTP) & Otomasyon Merkezi (`#view-email-automation`):**
  - Admin kullanıcı paneline **📧 E-Posta & Otomasyon (SMTP)** sekmesi eklendi (hem sol menüden hem de `Ekip & Personel` ve `Özel Raporlar` ekranlarındaki hızlı geçiş butonlarından erişilebilir).
  - **Exchange Online Plan 1 SMTP Yapılandırması:** `smtp.office365.com`, Port `587` (STARTTLS), E-posta Kullanıcı Adı (`bildirim@fggroup.com.tr`), Uygulama/Hesap Şifresi, Gönderici Başlığı, Callback Base URL (`http://10.1.0.45:3000`) ve `nodemailer` tabanlı canlı SMTP gönderim motoru (`EmailAndAutomationService`) entegre edildi.
  - **Canlı Test Maili Gönderimi (`POST /api/admin/smtp-test`):** Girilen Exchange Online kimlik bilgileriyle anında gerçek SMTP bağlantısını test eden veya yerel simülasyon modunda Outbox'a düşüren test mekanizması kuruldu.
* **Outlook "Actionable Messages" (E-Posta İçi Canlı Butonlar - Adaptive Cards v1.4):**
  - Gönderilen her e-postanın HTML gövdesine `<script type="application/adaptivecard+json">` formatında Microsoft Adaptive Card v1.4 JSON şeması gömüldü.
  - **3 Canlı Kart Senaryosu:**
    1. **Görev Sırası Geldi (`TASK_READY`):** Öncül görev tamamlandığında sıradaki sorumlu personele otomatik gider; e-posta içinden **"🚀 Göreve Başla (IN_PROGRESS)"** veya **"✅ Tamamlandı İşaretle"** butonlarına basılabilir.
    2. **Gecikme Açıklama Talebi (`DELAY_EXPLANATION` - KAB07):** Geciken görevler için e-posta içindeki kategori seçimi ve metin kutusundan doğrudan mazeret gönderilebilir.
    3. **Proje Görünürlük Onayı (`VISIBILITY_REQUEST` - KAB03):** Proje yöneticisinin e-posta içinden **Onayla / Reddet** kararı vermesini sağlar.
  - **HTTP POST Callback Endpoint (`POST /api/outlook/action`):** Outlook'tan (veya dahili canlı simülatörden) gelen `Action.Http` isteklerini işler, DAG bağımlılık motorunu tetikler, ardıl görevlerin kilidini açıp sıradaki kişiye otomatik yeni kart gönderir ve e-posta içindeki kartı `CARD-ACTION-STATUS` / `CARD-UPDATE-IN-BODY: true` başlıklarıyla anında günceller.
* **Zamanlanmış Otomatik Rapor Gönderimi (Scheduled Reports Engine):**
  - Admin panelinden **Günlük (`DAILY`), Haftalık (`WEEKLY`), Aylık (`MONTHLY`)** periyotlarda, belirlenen saatte (`09:00`, `18:00` vb.) ve seçilen alıcı listesine otomatik HTML + Adaptive Card rapor gönderimi tanımlama imkanı sağlandı.
  - **4 Rapor Türü:** Yönetici Özeti & KPI (`EXECUTIVE_SUMMARY`), Personel Performans Karnesi (`PERFORMANCE_SCORECARD` - `100 * (0.70*Z + 0.30*T)`), Darboğaz & Kritik Yol Analizi (`BOTTLENECK_ANALYSIS`) ve Tam kapsamlı paket (`FULL_PACKAGE`).
  - **"🚀 Şimdi Gönder" (`POST /api/admin/scheduled-reports/:id/send-now`):** Zamanlama saatini beklemeden tek tıkla anında raporu derleyip tüm alıcılara gönderme özelliği eklendi.
* **Tekstil 5 Kişilik Ekip Senaryosu & Test Doğrulaması:**
  - Seed veritabanı 5 kişilik tekstil ekibi (*"2027 İlkbahar/Yaz Tekstil Koleksiyonu - Tasarım Onayı & Numune Sunumu"*) ve hazır zamanlanmış rapor kurallarıyla zenginleştirildi.
  - **22/22 Birim & Kabul Testi (`npm test`)** eksiksiz geçti.

### 18. PostgreSQL İlişkisel Veritabanı Motoru (`PGlite` + `pg`) & `AES-256-GCM` Şifreli SMTP Kasası (Vault)
* **Çift Modlu PostgreSQL Veritabanı Mimarisi (`src/database/postgres.ts` & `src/database/schema.sql`):**
  - **Gömülü PostgreSQL 18 (`@electric-sql/pglite`):** Kurulum gerektirmeden `.work/pgdata` dizininde gerçek ilişkisel PostgreSQL motoru çalıştırıldı.
  - **Harici PostgreSQL Sunucu Desteği (`pg` / `node-postgres`):** İleride harici bir PostgreSQL sunucusuna geçilmek istendiğinde kod değiştirmeden yalnızca `DATABASE_URL=postgresql://kullanici:sifre@sunucu:5432/veritabani` ortam değişkeni veya `.work/pg-external.json` tanımlanarak anında geçiş yapılabilmesi sağlandı.
  - **15 İlişkisel Tablo Şeması (`src/database/schema.sql`):** `tenants`, `users`, `projects`, `project_plan_changes`, `project_members`, `visibility_requests`, `tasks`, `task_assignments`, `task_plan_changes`, `task_dependencies`, `delay_records`, `notifications`, `push_subscriptions`, `microsoft_todos`, `smtp_configs`, `scheduled_reports` ve `email_outbox` tabloları indeksleriyle birlikte oluşturuldu ve Write-Through senkronizasyon bağlandı.
* **`AES-256-GCM` Kurumsal Şifre Kasası (`src/core/crypto-vault.ts`):**
  - Exchange Online (SMTP) şifresi diske ve PostgreSQL `smtp_configs.encrypted_password` sütununa asla düz metin (plaintext) olarak yazılmaz; `enc:v1:<iv>:<authTag>:<cipher>` formatında **`AES-256-GCM` Authenticated Encryption** ile şifrelenerek saklanır.
  - 256-bit Master Key `.work/.vault.key` (veya `process.env.VAULT_MASTER_KEY`) üzerinden yönetilir ve `.gitignore` ile Git deposundan izole edilir.
* **Yeniden Başlatmada (Restart) Şifre & Veri Koruma Garantisi (`src/database/seed.ts` & `src/database/db.ts`):**
  - `seedDatabase(db, false)` idempotent hale getirildi; sunucu yeniden başlatıldığında mevcut projeler, görevler ve şifreli SMTP kimlik bilgileri asla sıfırlanmaz.
  - Ek olarak `.work/smtp-vault.json` ve PostgreSQL `smtp_configs` tablosu üzerinden çift katmanlı otomatik geri yükleme (auto-restore) eklendi.
  - **23/23 Birim & Kabul Testi (`npm test`)** eksiksiz geçti.

### 19. Tam Kapsamlı Outlook Adaptive Cards v1.4 Yaşam Döngüsü & Zorunlu Notlu İlerleme (`%40-%50-%60`) Otomasyonu
* **5 Yeni Otomatik E-Posta & Outlook Adaptive Card v1.4 İş Akışı (`src/modules/email/email.service.ts`, `src/modules/notification/notification.service.ts`):**
  1. **Projeye Dahil Edilme Bildirimi (`PROJECT_MEMBER_CARD`):** Bir kullanıcı projeye üye olarak eklendiğinde (`POST /api/projects/:id/members`) veya görünürlük talebi onaylandığında (`POST /api/projects/:id/visibility-decide`), kullanıcıya projedeki rolünü, proje takvimini ve kendisine atanan görevleri içeren canlı Adaptive Card e-postası otomatik gönderilir.
  2. **Görev Atama Bildirimi (`TASK_ASSIGNED_CARD`):** Yeni bir görev oluşturulduğunda (`POST /api/tasks`, `POST /api/projects/:id/tasks/bulk`) veya mevcut görevin sorumlusu değiştirildiğinde (`POST /api/tasks/:id/assign`), atanan personele görevin durumu (`READY` veya `BLOCKED`), öncül bağımlılıkları ve canlı aksiyon butonlarını içeren Adaptive Card e-postası gönderilir.
  3. **Zorunlu Not Kuralı ile `%20 / %40 / %50 / %60 / %80 / %100` İlerleme & Durum Güncellemesi (`ACTIONABLE_TASK_CARD` & `POST /api/tasks/:id/progress`):**
     - Personel hem doğrudan Outlook e-postası içindeki Adaptive Card üzerinden (`Input.ChoiceSet` ile `%20`, `%40`, `%50`, `%60`, `%80`, `%100` seçerek) hem de web arayüzündeki İş Paketi Çekmecesi (`#workPackageDrawer`) üzerinden görevi başlatabilir (`IN_PROGRESS`), kısmi ilerleme bildirebilir veya tamamlayabilir (`COMPLETED`).
     - **Zorunlu Not Kuralı (`TaskService.updateTaskProgressWithNote`):** Kısmi ilerleme (`%40`, `%50`, `%60` vb.) veya mazeret bildirilirken **açıklama/durum notu yazılması zorunludur**; boş not gönderildiğinde hem backend servisi hem de UI/Adaptive Card doğrulaması işlemi reddeder.
  4. **Proje Yetkililerine Otomatik "İş Tamamlandı" ve "İlerleme Güncellendi" Maili (`TASK_COMPLETED_MANAGER_CARD` & `TASK_PROGRESS_MANAGER_CARD`):**
     - Görev sorumlusu bir proje adımını tamamladığında (veya `%40/%50/%60` ilerleme + zorunlu not girdiğinde), projedeki yetkili kişilere (`PROJECT_MANAGER`, `EDITOR`, Proje Kurucusu ve `ADMIN`) *"Bu kişi bu işi tamamladı / ilerleme bildirdi"* başlıklı, girilen zorunlu notu, kilidi açılan yeni görevleri ve projenin güncel tamamlanma yüzdesini gösteren Adaptive Card e-postası otomatik gönderilir.
  5. **Zamanında Yapılmayan (Geciken) Görev Uyarısı (`DELAY_EXPLANATION_CARD` & `OVERDUE_MANAGER_ALERT`):**
     - Görev planlanan bitiş tarihinde tamamlanmadığında hem görev sorumlusuna zorunlu gecikme açıklaması + `%40/%50/%60` ilerleme kartı gönderilir, hem de projedeki yetkili kişilere (`PROJECT_MANAGER`, `EDITOR`, `ADMIN`) geciken görev ve darboğaz etkisi hakkında acil uyarı e-postası (`OVERDUE_MANAGER_ALERT`) iletilir.
* **Canlı Senaryo Merkezi (`POST /api/admin/trigger-card-scenario` & `#view-email-automation`):**
  - `outlook_adaptive_cards_rehberi.md` dokümanındaki tüm 5 senaryoyu Exchange Online (SMTP) ve Canlı Outlook Kart Simülatörü üzerinde tek tıkla test edebilen **"📘 Outlook Adaptive Cards Rehberi v1.4 & Canlı Senaryo Merkezi"** paneli eklendi.
  - **24/24 Birim & Kabul Testi (`npm test`)** eksiksiz geçti.

### 20. Yeni Kullanıcı Karşılama & Sistem Erişim E-postası (`USER_WELCOME_CARD`), Kendi Şifresini Oluşturma/Değiştirme ve Profil Resmi (`avatar_url`)
* **Yeni Kullanıcı Eklendiğinde Otomatik Karşılama Maili (`EmailAndAutomationService.sendUserWelcomeCard` & `POST /api/admin/personnel`):**
  - Yönetici yeni bir personel kartı eklediğinde (`POST /api/admin/personnel`), eklenen personelin e-posta adresine otomatik olarak **Sistem Giriş Adresi (`URL`), Kullanıcı E-posta Adresi, İlk Giriş Şifresi, Departman/Rol Yetkileri** ve şifre/profil resmi güncelleme adımlarını içeren **HTML + Adaptive Card v1.4 (`USER_WELCOME_CARD`)** e-postası gönderilir.
* **Kullanıcıların Giriş Yaptıktan Sonra Kendi Şifrelerini Oluşturması / Değiştirmesi (`PUT /api/profile/password` & `#userProfileModal`):**
  - Sol alttaki kullanıcı profiline tıklandığında açılan **👤 Kullanıcı Profili & Tercihler (`#userProfileModal`)** penceresine **"🔐 Şifre Oluştur / Değiştir"** bölümü eklendi (`Mevcut Şifre`, `Yeni Şifre`, `Yeni Şifre Tekrar`, `👁️ Göster/Gizle`).
  - [`AuthService.changeOwnPassword`](file:///y:/gorevler1/src/modules/auth/auth.service.ts) ile şifre doğrulaması yapılarak yeni şifre hem yerel veritabanına hem de PostgreSQL `users` tablosuna (`AES-256-GCM` şifreli) kaydedilir.
* **Kullanıcı Profil Resmi Yükleme / Kaldırma (`PUT /api/profile/avatar` & `users.avatar_url`):**
  - Kullanıcılar **👤 Kullanıcı Profili & Tercihler** penceresinden **"📷 Profil Resmi Yükle / Değiştir"** butonuyla kendi fotoğraflarını seçebilir; görsel tarayıcıda otomatik olarak `256x256` kare formata kırpılıp sıkıştırılarak veritabanına (`users.avatar_url`) kaydedilir ve sol menüde, personel tablosunda ve görev detay çekmecesinde görüntülenir.
  - **25/25 Birim & Kabul Testi (`npm test`)** eksiksiz geçti.

### 21. Yüksek Kaliteli Outlook Adaptive Card Görsel Çerçevesi (`renderAdaptiveCardHtmlFrame`) & E-Postadan Tek Tıkla Görev Aksiyonu (`GET /api/quick-action`)
* **Outlook Rehberine (`outlook_adaptive_cards_rehberi.md`) Birebir Uygun Görsel Kart Çerçevesi (`renderAdaptiveCardHtmlFrame`):**
  - Outlook masaüstü, web ve mobil istemcilerinde Microsoft Actionable Messages motoru (HTTPS ve kayıtlı GUID gereksinimi sebebiyle) devre dışı kaldığında dahi, e-postanın rehberdeki canlı kart ile birebir aynı görsel zenginlikte görünmesini sağlayan yüksek kaliteli HTML e-posta şablonu geliştirildi.
  - Şablon öğeleri: Koyu lacivert üst başlık şeridi (`#0f172a`), kategori etiketi (`📌 YENİ GÖREV ATAMA BİLDİRİMİ`), renk kodlu durum rozeti (`🟢 Başlamaya Hazır (READY)`, `⚡ Devam Ediyor (%50)`, `✓ Tamamlandı (%100)`, `⏳ Öncül Bekliyor (BLOCKED)`, `🚨 Termin Aşıldı`), proje ve görev başlığı, biçimlendirilmiş veri tablosu (`FactSet`), görsel grafik ilerleme çubuğu, hızlı ilerleme çipleri (`%20`, `%40 Bildir`, `%50 Yarılandı`, `%60 Bildir`, `%80 Son Aşama`) ve büyük aksiyon butonları (`▶️ Görevi Başlat (%25)`, `✅ Tamamlandı İşaretle (%100)`, `🔗 Görev Detayını Aç & Yönet ➔`).
  - Görev atama, görev hazır olma, projeye dahil edilme, yöneticiye tamamlandı bildirimi, yöneticiye ilerleme bildirimi, gecikme mazeret kartı, darboğaz uyarısı, görünürlük onay talebi ve yeni kullanıcı karşılama maillerinin tamamı bu zengin şablonla gönderilmektedir.
* **E-Postadan Tek Tıkla Anında Görev Yönetimi (`GET /api/quick-action`):**
  - Kullanıcı Outlook'ta e-postayı açıp herhangi bir butona (`▶️ Görevi Başlat`, `✅ Tamamlandı İşaretle`, `%40/%50/%60 Bildir` vb.) tıkladığında, arka planda güvenli `GET /api/quick-action` rotası tetiklenir:
    - `START_TASK`: Görevi anında `IN_PROGRESS` yapar.
    - `UPDATE_PROGRESS`: İlerleme oranını (`%20`, `%40`, `%50`, `%60`, `%80`) günceller, otomatik e-posta notunu düşer ve proje yöneticilerine bildirim iletir.
    - `COMPLETE_TASK`: Görevi `%100 COMPLETED` yapar, bekleyen ardıl görevlerin kilidini açar, ardıl sorumlulara *"Sıra Sizde"* maili ve proje yetkililerine tamamlama raporu gönderir.
  - İşlem sonrası kullanıcıya modern bir başarı teyit ekranı sunulur ve 3 saniye içinde web uygulamasındaki ilgili görevin detay çekmecesine otomatik yönlendirme (`redirect`) yapılır.
* **Doğrudan Görev Çekmecesi Açma Desteği (`?task_id=...` & `openTaskDrawer`):**
  - Web uygulaması açılışında (`loadInitialData`) URL parametresindeki `task_id` otomatik okunarak ilgili görevin OpenProject bölmeli ekran çekmecesi (`#workPackageDrawer`) doğrudan açılır.
* **Tüm Testler ve Doğrulama:**
  - `OUTLOOK ADAPTIVE CARD EMAIL FRAME & ONE-CLICK QUICK ACTIONS` testi dahil olmak üzere **26/26 Birim & Kabul Testi (`npm test`)** eksiksiz geçti.

### 22. Personeli Devre Dışı Bırakma & Erişim Engelleme (İşten Ayrılan / Pasif Personel Yönetimi)
* **İşten Ayrılan Personel İçin Devre Dışı Bırakma Desteği (`User.is_active: false`):**
  - Personel kartlarına `is_active?: boolean` (varsayılan `true`), `deactivated_at?: string` (ISO 8601 tarih damgası) ve `deactivation_reason?: string` (ayrılma/devre dışı bırakma gerekçesi) alanları eklendi.
  - PostgreSQL şeması (`src/database/schema.sql`) ve otomatik senkronizasyon (`src/database/postgres.ts`) güncellendi (`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`, `deactivated_at`, `deactivation_reason`).
* **Sistem Erişimi & Giriş Engeli (`AuthService` & `server/index.ts` Middleware):**
  - [`AuthService.login`](file:///y:/gorevler1/src/modules/auth/auth.service.ts) ve `authenticateEntraUser` metotları devre dışı bırakılmış personelin sisteme giriş yapmasını doğrudan engeller (`Bu personel hesabı devre dışı bırakılmıştır. Sisteme giriş yapamazsınız`).
  - [`getAuthContext`](file:///y:/gorevler1/src/server/index.ts) kimlik doğrulama ara yazılımı (middleware) her istekte kullanıcının `is_active !== false` olduğunu kontrol eder. Önceden oturum açmış olsa bile devre dışı bırakıldığı anda mevcut oturumu geçersiz kılınır ve `403 Forbidden` döner.
* **Görev Atama & Proje Üyeliği Koruması (`TaskService` & `ProjectService`):**
  - Devre dışı bırakılmış personele yeni görev oluşturulamaz veya mevcut görev devredilemez (`createTask`, `assignTask`).
  - Devre dışı bırakılmış personel yeni projelere üye/sorumlu olarak eklenemez (`ProjectService.addOrUpdateMember`).
  - Görev atama ve proje üyesi seçim açılır kutularında (`#wpAssigneeSelect`, `#tAssignee`, `#newProjectMembersChecklist`, `#pmUserSelect`) devre dışı bırakılmış personel filtrelenir; geçmişten kalan atamalar varsa listede `[Devre Dışı / Ayrıldı]` etiketiyle açıkça gösterilir.
* **Yönetici Kendini Kilitleme Koruması (Admin Self-Lockout Guard):**
  - Yönetici (`admin`) kullanıcılar yanlışlıkla kendi hesaplarını devre dışı bırakamaz; sistem `Yöneticiler kendi hesaplarını devre dışı bırakamaz` uyarısıyla işlemi engeller.
* **Personel Düzenleme Modalı (`#personnelModal`) & Ekip Tablosu Görünümü:**
  - **Personel Bilgilerini Düzenle** modalına renkli durum rozeti (`🟢 Aktif` / `⛔ Devre Dışı`), *"Bu personeli devre dışı bırak (Sisteme erişimi engellenir)"* onay kutusu (`#persIsDeactivated`) ve isteğe bağlı devre dışı bırakma nedeni alanı (`#persDeactivationReason`) eklendi.
  - **Personel Tablosu (`#personnelTable`)**: Tabloya `Hesap Durumu` sütunu eklendi; pasif personel satırları hafif soluklaştırılıp kırmızı `⛔ Devre Dışı` rozetiyle işaretlenir.
* **Tüm Testler ve Doğrulama:**
  - `PERSONNEL DEACTIVATION & ACCESS BLOCKING` kabul testi dahil olmak üzere **27/27 Birim & Kabul Testi (`npm test`)** başarıyla geçti.

### 23. Arama & Canlı Filtre Alanlarının Temiz Başlaması (Tarayıcı Otomatik Doldurma Engellemesi)
* **Gantt, Görevler ve Kanban Arama Kutularının Temiz Başlaması (`clearAllSearchFilters`):**
  - Tarayıcıların (Chrome/Edge) kayıtlı giriş bilgisi nedeniyle Zaman Çizelgesi (Gantt) `#ganttSearchInput`, İş Paketleri `#taskSearchInput` veya Kanban `#kanbanSearchInput` alanlarına otomatik olarak "admin" doldurması (autofill) engellendi.
  - Arama kutularına `autocomplete="off"`, `autocorrect="off"`, `autocapitalize="off"`, `spellcheck="false"`, `data-lpignore="true"` ve belirgin `name` öznitelikleri tanımlandı.
  - Uygulama başlatıldığında (`DOMContentLoaded`), oturum açıldığında (`onLoginSuccess`), veri yüklendiğinde (`loadInitialData`), görünüm değiştirildiğinde (`switchView`) ve sayfa gösterildiğinde (`pageshow`) arama kutularının tamamen boş (`value = ''`) ve arama filtrelerinin temiz (`state.searchQuery = ''`) gelmesi garanti altına alındı.
  - Kullanıcı `Escape` tuşuna bastığında aramanın anında sıfırlanması sağlandı.

### 24. Yeni Görev Ekle Modalında Proje Seçimi ve Bireysel Görev (Kişisel To-Do) Mimarisi
* **Yeni Görev Ekle Modalı (`#taskModal`) Proje Seçim Açılır Kutusu (`#tProject`):**
  - Modala `📁 Ait Olduğu Proje` seçim alanı ve seçim durumuna göre dinamik rozet (`#tProjectBadge`) ile bilgilendirme kutusu (`#tPersonalNotice`) eklendi.
  - Açılır kutuda en üstte `📌 Bireysel Görev / Kişisel To-Do (Projesiz Takip)` seçeneği ve altında yetkili olunan şirket projeleri listelenir.
* **Yetki Kuralı & Standart Personel Kısıtlaması (`TaskService.createTask`):**
  - **Standart Çalışanlar (`can_create_project: false` ve proje editörü olmayanlar):** Şirket projelerine izinsiz görev açamaz; modal açıldığında proje alanı kilitli olarak `📌 Bireysel Görev` gelir, sorumlu kişi kendisi olur (`assignee_id = auth.user_id`) ve öncül bağımlılık alanı devre dışı bırakılır.
  - **Proje Yetkilileri (Admin, Proje Lideri, PM / Editör):** Yetkili oldukları projeleri seçerek projedeki herhangi bir çalışana görev atayabilir; dilerlerse projeyi boş bırakıp (bireysel seçip) kendileri için takip amaçlı şahsi to-do oluşturabilirler.
* **Veritabanı & PostgreSQL Null Desteği:**
  - `tasks.project_id` esnetilerek `NULL` desteği sağlandı (`ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL;`).
  - Bireysel görevlerde `project_id = null` ve `assignee_id = auth.user_id` olarak saklanır.
* **Görevler, Gantt ve Kanban Görünümlerinde Ayrım:**
  - **Görevlerim (`view-my-tasks`):** Hem şirket projelerindeki görevler (`📁 Proje Adı` etiketiyle) hem de bireysel işler (`📌 Kişisel To-Do` mor rozetiyle) listelenir. Sekme çubuğuna `📌 Kişisel To-Do` filtre sekmesi eklendi.
  - **Zaman Çizelgesi (Gantt):** Yalnızca o projeye ait görevleri çizer (`t.project_id === state.currentProjectId`); personelin kişisel to-do'ları şirket Gantt takvimini asla kirletmez.
  - **Kanban Panosu:** Seçili projenin iş akışını korur.
* **Tüm Testler ve Doğrulama:**
  - `PROJE GÖREVİ & BİREYSEL TO-DO AYRIMI` kabul testi dahil olmak üzere **28/28 Birim & Kabul Testi (`npm test`)** eksiksiz geçti.
