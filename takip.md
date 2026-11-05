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

### 25. Yönetici Felaket Kurtarma & Otomatik Yedekleme Modülü (Disaster Recovery & Backup)
* **Modül Amacı & İki Kademeli Kurtarma Mimarisi:**
  - Sistemin başına beklenmedik bir kaza, veri bozulması veya yanlış işlem geldiğinde yöneticinin tek tıkla sistemi ayağa kaldırması için `BackupAndRecoveryService` (`src/modules/backup/backup.service.ts`) geliştirildi.
  - **1. Tam Sistem Geri Yükleme (Full Restore):** Tüm projeleri, görevleri, bağımlılıkları ve ayarları yedeğin alındığı ana döndürür.
  - **2. Tekil Proje Kurtarma (Single Project Recovery):** Diğer hiçbir projeye ve personele dokunmadan, yalnızca kazaya uğrayan tek bir projeyi ve ona bağlı görev/bağımlılıkları yedekten kurtarır.
  - **3. Otomatik Güvenlik Yedeği (`PRE_RESTORE_SAFETY`):** İster tam ister tekil proje kurtarma yapılsın, sistem kurtarma işlemine başlamadan hemen önce o anki mevcut durumun otomatik güvenlik yedeğini alır. Yönetici yanlış bir yedeğe dönse dahi anında geri alma imkanına sahiptir.
* **Otomatik Zamanlayıcı (Scheduler) & Saklama Politikası (Retention):**
  - **Günlük Otomatik Yedekleme:** Belirlenen saatte (varsayılan 02:00) otomatik çalışır ve `daily_retention_days` (varsayılan 14 gün) süresini aşan eski günlük yedekleri temizler.
  - **Haftalık Arşiv Yedeği:** Belirlenen gün ve saatte (varsayılan Pazar 03:00) çalışır ve `weekly_retention_weeks` (varsayılan 8 hafta) süresini aşan yedekleri temizler.
  - Arka planda 60 saniyelik interval ile otomatik tetikleme ve yönetici bildirim e-postası desteği.
* **Bütünlük & Güvenlik:**
  - Her yedek dosyası SHA-256 hash imzasıyla mühürlenir. Geri yüklemede dosya bütünlüğü kontrol edilir.
  - Harici JSON yedek dosyalarını içe aktarma (`import`) ve bilgisayara indirme (`download`) işlevleri.
  - PostgreSQL ve AES-256-GCM kasa yapısıyla anlık senkronizasyon kancası (`setPostgresSyncHook`).
* **Yönetici Arayüzü (`#view-backup-recovery`):**
  - Sol menüde **YÖNETİM** başlığı altına `🛡️ Yedekleme & Kurtarma` menüsü ve `Disaster` rozeti eklendi.
  - 4 adet canlı KPI kartı: Son Başarılı Yedek, Toplam Yedek Sayısı & Boyut, Günlük Otomatik Plan, Haftalık Otomatik Plan.
  - Otomatik zamanlama planı formu (`#backupScheduleForm`), anlık manuel yedek butonu (`#createBackupNowBtn`), dış yedek yükleme butonu (`#importBackupBtn`).
  - Yedek geçmişi tablosu, tekil proje kurtarma modalı (`#restoreProjectModal`) ve silme/indirme butonları.
* **Kabul Testleri & Doğrulama:**
  - `FELAKET KURTARMA & YEDEKLEME SİSTEMİ` kabul testi yazıldı.
  - **29/29 Birim & Kabul Testi (`npm test`)** ve **TypeScript Derlemesi (`npm run build`)** başarıyla geçti.

---

## 26. Görev Müdahale Koruması ve İcra İzolasyonu (Başkası Yerine İşlem Yapmayı Engelleme)

### 26.1. İster Özeti & Karşılaşılan Eksiklik
- **Kullanıcı Talebi:** Hiçbir kullanıcı bir diğeri yerine verilen görevleri başlatamamalı, ilerletememeli, durumunu değiştirememeli veya bitirememeli (kısaca başkasının görevine müdahale edememeli).
- **Amaç:** Görev icra sorumluluğunu kesin olarak görev sahibine bağlamak; veri tahrifatını, yanlışlıkla başkasının işini kapatmayı engellemek ve performans ölçümlerinin adil olmasını garanti etmek.

### 26.2. Uygulanan Mimari ve Güvenlik Mekanizmaları
1. **İş Mantığı & Servis Katmanı (`src/modules/task/task.service.ts` & `src/modules/delay/delay.service.ts`):**
   - `assertCanExecuteTask(auth, task, actionName)` metodu eklendi: Eğer görev bir personele atanmışsa (`task.assignee_id`) ve işlem yapan kişi (`auth.user_id`) görev sahibi değilse açıklayıcı hata ile işlem durdurulur (`Yetkisiz Müdahale Engellendi: Bu görev "${assigneeName}" adlı personele atanmıştır...`).
   - `assertCanModifyTask(auth, task)` metodu eklendi: Görev tanımını, önceliğini ve plan tarihlerini yalnızca sorumlu veya projenin yöneticisi / editörü (veya sistem yöneticisi) değiştirebilir.
   - `startTask`, `completeTask`, `updateTaskProgressWithNote`, `updateStatus` ve `delayService.submitExplanation` metotları bu yetki duvarı ile korundu.
   - Sahipsiz (atanmamış) görevler başlatıldığında veya tamamlandığında işlemi başlatan personele otomatik olarak zimmetlenir.
2. **REST API Güvenlik Duvarı (`src/server/index.ts`):**
   - `GET /api/tasks/:id/details`: Yanıta `is_assignee` bayrağı eklendi.
   - `PATCH /api/tasks/:id`: İlerleme güncellemesi için icra yetkisi; başlık/tanım/öncelik güncellemesi için yönetici/editör/sorumlu yetkisi zorunlu kılındı.
   - `POST /api/tasks/:id/assign`: Sorumlu atama yetkisi yalnızca Proje Yöneticisi, Proje Editörü veya Sistem Yöneticisine sınırlandırıldı.
3. **Kullanıcı Arayüzü & Çekmece Koruması (`src/public/index.html`, `src/public/styles.css`, `src/public/app.js`):**
   - `#workPackageDrawer` içine kırmızı çerçeveli `#wpTaskLockBanner` bilgi bandı yerleştirildi: Başkasının görevi açıldığında *"🔒 Müdahale Kısıtlaması: Bu görev [Personel Adı] adlı personele atanmıştır. Görevi başlatma, tamamlama ve ilerleme kaydetme yetkisi yalnızca atanmış personele aittir"* uyarısı verilir.
   - Başkasına ait görevlerde **"Göreve Başla"** ve **"Görevi Tamamla"** butonları gizlenir; ilerleme kaydırıcısı ve hızlı butonlar devre dışı bırakılır.
   - Kanban panosunda (`renderBoard`) başkasına ait kartlar `draggable="false"` yapılır, hafif matlaştırılır (`.not-my-task`) ve sürükleme girişiminde uyarı bildirimi gösterilir.
4. **Test ve Doğrulama:**
   - `tests/acceptance.test.ts` içine kapsamlı kabul testi (`KORUMA & MÜDAHALE ENGELİ`) eklendi.
   - **30/30 Kabul Testi (`npm test`)** ve **TypeScript Derlemesi (`npm run build`)** hatasız tamamlandı.

---

## 27. Kişisel Takvim Entegrasyonu (iCalendar RFC 5545, Outlook Web & Google Calendar)

### 27.1. İster Özeti
- **Kullanıcı Talebi:** Kişilere gönderilen görev maillerinin kişilerin kişisel takvimine eklenebilecek formatta gönderilmesi; gelen görevi gören personelin tek tıkla kendi takvimine işleyebilmesi.
- **Hedef:** Hiçbir ek lisans gerektirmeden çalışan e-posta motorumuz üzerinden hem otomatik takvim eki (`.ics`), hem alarmlı takvim kutusu, hem de tek tıkla web takvimlerine (Outlook Web / Google Calendar) aktarma imkanı sunmak.

### 27.2. Geliştirilen Bileşenler ve Mimari
1. **RFC 5545 Standart Takvim Motoru (`src/modules/email/email.service.ts`):**
   - `generateTaskIcsContent`: Göreve özel `UID: task-{id}@fggroup.com.tr`, `DTSTART`, `DTEND`, `SUMMARY`, `DESCRIPTION` ve 2 adet otomatik hatırlatma alarmı (`VALARM`: teslimden 1 gün önce `-P1D` ve teslim günü 2 saat kala `-PT2H`) üreten motor yazıldı.
   - `buildCalendarLinks`: Görev için doğrudan `.ics` indirme linki, Microsoft 365 / Outlook Web compose linki ve Google Calendar render linki üreten yardımcı eklendi.
   - `renderAdaptiveCardHtmlFrame`: E-posta gövdesine şık **"📅 KİŞİSEL TAKVİMİNİZE EKLEYİN (HATIRLATICI ALARMLI)"** kutusu ve 3 adet tek tıkla takvim butonu eklendi.
   - `dispatchEmail`: `nodemailer` gönderiminde `icalEvent` ve `attachments` (`text/calendar; charset=utf-8; method=PUBLISH`) desteği eklendi; böylece Outlook ve mobil e-posta istemcileri e-postanın en üstünde yerel "Takvime Ekle" şeridini otomatik çıkarır.
2. **REST API Endpoint'i (`src/server/index.ts`):**
   - `GET /api/tasks/:id/calendar.ics`: Görevin `.ics` dosyasını `text/calendar; charset=utf-8` başlığıyla doğrudan indiren endpoint açıldı.
   - `GET /api/tasks/:id/details`: Yanıta `calendar_links` eklendi.
3. **Web Arayüzü Çekmecesi (`src/public/index.html` & `src/public/app.js`):**
   - Görev detay çekmecesindeki zaman planı altına 3 adet takvim butonu yerleştirildi (`📅 Takvimime Ekle (.ics)`, `🌐 Outlook Web`, `📆 Google Takvim`).
4. **Test ve Doğrulama:**
   - `tests/acceptance.test.ts` içine `.ics` üretimi, alarmlar, deeplinkler ve e-posta şablonunu doğrulayan kabul testi eklendi.
   - **31/31 Kabul Testi (`npm test`)** ve **TypeScript Derlemesi (`npm run build`)** başarıyla geçti.

---

## 28. Görev Detayının Ekran Ortasına Alınması (Centered Modal) ve Başkası Adına Not Girişinin Engellenmesi

### 28.1. İster Özeti
- **Kullanıcı Talebi:**
  1. Göreve basıldığında sağ tarafta açılan panelin ekranın ortasına alınması (ortalanmış modern modal tasarımı).
  2. Bir kullanıcının başkasının görevine girip inceleyebilmesi ancak onun adına not, açıklama veya gerekçe ekleyememesi (not kutusunun kilitlenmesi).

### 28.2. Geliştirilen Çözüm ve Mimari
1. **Ortalanmış Modal Tasarımı (`src/public/styles.css`):**
   - `.op-split-drawer` sağa dayalı panelden (`right: 0`, `height: 100vh`) çıkarılarak ekranın tam ortasına (`top: 50%`, `left: 50%`, `transform: translate(-50%, -50%)`), `width: 720px`, `max-height: 90vh`, `border-radius: 16px` ve `box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.35)` ile modern bir modal penceresine dönüştürüldü.
   - `#wpDrawerBackdrop` arka planı karartıcı ve `backdrop-filter: blur(5px)` ile z-index 9999 olarak modalın altına bağlandı.
   - Açılış/kapanış akıcı `scale` ve `opacity` animasyonuyla donatıldı; klavyeden `ESC` tuşuna basıldığında modalın otomatik kapanması sağlandı.
2. **Başkası Adına Not / Açıklama Giriş Koruması:**
   - **Arayüz (`src/public/index.html` & `src/public/app.js`):**
     - Başkasına ait görev görüntülendiğinde not ekleme formu (`#wpInlineExpForm`) gizlendi; yerine kırmızı çerçeveli `🔒 Not Ekleme Kısıtlaması: Bu görev [Personel Adı] adlı personele aittir. Başkası adına aktivite notu veya gerekçe eklenemez.` bilgi uyarısı yerleştirildi.
     - Form submit işlemi istemci tarafında da `try/catch` ve yetki doğrulamasıyla güvenliğe alındı.
   - **Sunucu & İş Mantığı (`src/modules/delay/delay.service.ts`):**
     - `submitExplanation` fonksiyonunda görev başka bir personele atanmışsa (`task.assignee_id && task.assignee_id !== auth.user_id`) ve çağrıyı yapan kişi sistem yöneticisi (ADMIN) değilse işlem `Yetkisiz Müdahale Engellendi: Bu görev başka bir personele atanmıştır. Açıklama veya gerekçe yalnızca atanan sorumlu tarafından girilebilir.` istisnası fırlatarak kesin olarak reddedilir.
3. **Test ve Doğrulama:**
   - `tests/acceptance.test.ts` içine editör veya başka bir personelin başkasının görevine not ekleyemediğini doğrulayan kabul senaryosu eklendi.
   - **31/31 Kabul Testi** başarıyla tamamlandı, derleme hatasız alındı.

---

## 29. Bildirim Merkezi Çekmecesinin Onarılması, Tekilleştirme ve Okundu Sayılarak Sıfırlanması

### 29.1. İster Özeti
- **Kullanıcı Talebi:** Bildirim zilinde 45 bildirim görünmesi ancak tıklandığında açılmaması; ayrıca açıldığında bildirimlerin görüntülenmesi ve okunmamış sayacının sıfırlanması talebi.
- **Kök Neden Tespiti:**
  1. `#notifDrawer` bileşeni `.drawer-backdrop` sınıfı taşıyordu; ancak CSS'te `.drawer-backdrop.open` kuralı ve `.drawer-panel` boyut/konum kuralları tanımlı değildi (`display: none` olarak kalıyordu).
  2. Sistemde her bildirim olayı için 3 ayrı kanal (`IN_APP`, `EMAIL`, `WEB_PUSH`) kaydı üretildiğinden, arayüz filtresiz toplam 45 kaydı sayıyordu (15 gerçek olay x 3 kanal).
  3. Bildirimler için okundu/okunmadı (`is_read`, `read_at`) takibi ve sıfırlama mekanizması eksikti.

### 29.2. Geliştirilen Çözüm ve Mimari
1. **Bildirim Çekmecesi Arayüz & CSS Onarımı (`src/public/styles.css`):**
   - `#notifDrawer.drawer-backdrop` z-index 10050, arka plan karartma ve `backdrop-filter: blur(4px)` ile yapılandırıldı.
   - `.drawer-panel` sağdan kayarak açılan (`width: 440px`, `height: 100vh`, `box-shadow: -10px 0 35px rgba(0,0,0,0.25)`) modern bir çekmece haline getirildi; dark mode desteği eklendi.
   - Bildirim kartları (`.notif-card-item`) okundu/okunmadı durumuna göre belirginleştirildi (`.unread-item`), başlık, açıklama, tarih ve tıklandığında ilgili görevi açan `Görevi Aç ➔` aksiyonu sağlandı.
   - Çekmece başlığına **"🗑️ Temizle"** ve **"🔄 Tara"** butonları eklendi.
2. **Kanal Tekilleştirme & Otomatik Sayaç Sıfırlama (`src/public/app.js`):**
   - Arayüzde `channel === 'IN_APP'` tekilleştirmesi yapılarak kullanıcının aynı olayı 3 kez görmesi engellendi.
   - Çan ikonuna basıldığı anda çekmece akıcı animasyonla açılır; `POST /api/notifications/read-all` çağrısıyla tüm bildirimler okundu işaretlenir ve kırmızı sayaç rozeti (`#notifBadge`) anında sıfırlanır (gizlenir).
   - ESC tuşuyla veya çekmece dışına tıklandığında kapanma sağlandı.
3. **Veritabanı & REST API Desteği (`src/database/db.ts`, `src/modules/notification/notification.service.ts`, `src/server/index.ts`):**
   - `Notification` modeline `is_read?: boolean` ve `read_at?: string` alanları eklendi (`schema.sql` güncellendi).
   - `markAllNotificationsAsRead` ve `clearNotifications` veritabanı metotları yazıldı.
   - `POST /api/notifications/read-all` ve `POST /api/notifications/clear-all` uç noktaları bağlandı.
4. **Test ve Doğrulama:**
   - `tests/acceptance.test.ts` içine okundu işaretleme, okunmamış rozet sıfırlama ve bildirim temizleme test senaryoları eklendi.
   - **32/32 Kabul Testi (`npm test`)** ve **TypeScript Derlemesi (`npm run build`)** başarıyla geçti.

---

## 30. TEKSTİL İŞ AKIŞI MİMARİSİ: İŞ ADIMLARI, GÖREV TANIMLARI KATALOĞU VE OTOMATİK ŞABLON (04 Kasım 2026)

### 30.1. İster ve Problem Özeti
- **Kullanıcı Talebi:** FG Group tekstil üretim akışını temsil eden Excel tablosunun (İş Adımları, Görev Tanımı, Başlangıç/Bitiş Tarihi, Görevi Atayan: Musa, Görev Sahibi) sisteme entegre edilmesi.
- **Kritik Gereksinimler:**
  1. Görev oluşturulurken serbest metin yerine departman bazlı **İş Adımları** (`KOLEKSİYON OLUŞTURMA`, `KUMAŞ`, `TEKNİK ÇİZİM`, `KALIP MODELHANE`, `DİKİM`, `YIKAMA`, `FINISHING`) seçimi.
  2. Tür/Tanım kısmında seçilen iş adımına ait **Görev Tanımları** kataloğundan seçim yapılması.
  3. Yeni iş adımı ve görev tanımı ekleme yetkisinin **yalnızca Proje Yöneticisi ve Sistem Yöneticisi (Admin)** rollerine verilmesi.
  4. Tablodaki çift `YIKAMA` gibi aynı adı taşıyan adımların karışmaması için görev başlığının `[İş Adımı] Görev Tanımı` formatında otomatik birleştirilmesi.
  5. Excel'deki "Görevi Atayan: Musa Bey" bilgisinin sistemde görev atayan yetkili (`assigned_by_user_id`) olarak saklanması ve görev detay çekmecesinde gösterilmesi.
  6. Seçilen iş adımına göre departman personelinin (Dilara Kızıldağ, Cem AYLA, Devrim, Nilüfer, İbrahim Yıldız, Gönül) sorumlu seçiminde akıllıca önerilmesi.
  7. Tek tıkla 8 adımlı FG Group tekstil üretim akışını oluşturan `⚡ Tekstil Şablonunu Uygula` motoru.

### 30.2. Gerçekleştirilen Mimari & Kod Değişiklikleri
1. **Veri Modeli & Şema (`src/core/types.ts`, `src/database/schema.sql`, `src/database/db.ts`):**
   - `Task` arayüzüne `workflow_step?: string`, `task_definition?: string`, `assigned_by_user_id?: UUID` alanları eklendi.
   - `WorkflowStep` ve `TaskDefinitionTemplate` veri tipleri ve tabloları oluşturuldu.
   - Veritabanı sınıfına `getWorkflowSteps`, `insertWorkflowStep`, `getTaskDefinitionTemplates`, `insertTaskDefinitionTemplate` metotları eklendi.
2. **Seed Verisi & Personel Eşlemesi (`src/database/seed.ts`):**
   - Excel tablosundaki tüm personeller (Musa Bey - Proje Yetkilisi, Dilara Kızıldağ - Tasarım, Cem AYLA - Kumaş, İbrahim Yıldız - Yıkama, Devrim Modelist - Modelhane, Nilüfer Usta - Dikim, Gönül Finish - Finishing) sisteme dahil edildi.
   - 7 adet standart iş adımı ve 8 adet standart tekstil görev şablonu varsayılan olarak tanımlandı.
3. **Servis ve REST API Katmanı (`src/modules/task/task.service.ts`, `src/server/index.ts`):**
   - `taskService.createTask` metodu `workflow_step`, `task_definition` ve `assigned_by_user_id` alanlarını destekleyecek şekilde güncellendi.
   - `GET /api/workflow-steps` & `POST /api/workflow-steps` (Yalnızca Proje Yöneticisi / Admin yetkili).
   - `GET /api/task-definitions` & `POST /api/task-definitions` (Yalnızca Proje Yöneticisi / Admin yetkili).
   - `GET /api/tasks/:id/details`: Görevi atayan yetkili bilgisini (`assigner`) ve iş adımı rengini (`workflow_step_info`) döndürecek şekilde zenginleştirildi.
   - `POST /api/projects/:id/apply-textile-template`: Excel tablosundaki 8 adımlı süreci tarihleri, termin süreleri ve ardışık bağımlılıkları (DAG) ile tek tıkla otomatik oluşturan motor geliştirildi.
4. **Kullanıcı Arayüzü & Ergonomi (`src/public/index.html`, `src/public/styles.css`, `src/public/app.js`):**
   - Görev oluşturma modalında 1. İş Adımı ve 2. Görev Tanımı açılır listeleri entegre edildi. Yetkili kullanıcılar için modal içinden çıkmadan anında yeni adım/tanım ekleme butonları (`+ Yeni Adım Ekle`, `+ Yeni Tanım Ekle`) ve pop-up modalları eklendi.
   - İş adımı seçildiğinde ilgili departman personeli `⭐ Önerilen Personel` başlığı altında listenin en tepesinde gruplandı.
   - Görev tanımı seçildiğinde termin süresi (gün) otomatik hesaplandı ve `#tTitle` alanına `[İş Adımı] Görev Tanımı` başlığı otomatik dolduruldu.
   - Görev detay çekmecesine iş adımı renk rozeti (`#wpStepBadge`) ve **"🎯 Görevi Atayan (Proje Yetkilisi): Musa Bey"** satırı (`#wpAssignerRow`) eklendi.
   - Üst çubuğa Proje Yöneticisi için **"⚡ Tekstil Şablonunu Uygula"** butonu yerleştirildi.
   - Kanban kartlarında, Zaman Çizelgesi (Gantt) tablosunda ve Görevlerim listesinde iş adımı etiketleri renklendirilmiş rozetlerle gösterildi.
5. **Test ve Doğrulama:**
   - `tests/acceptance.test.ts` içine dinamik iş adımı ekleme, görev tanımı şablonu kaydetme, görev atayan kaydı ve 8 adımlı tekstil bağımlılık yaşam döngüsü test senaryosu eklendi.
   - **33/33 Kabul Testi (`npm test`)** başarıyla geçti.
   - **TypeScript Derlemesi (`npm run build`)** 0 hata ile tamamlandı.

---

## 31. GÖREV ATAYAN PERSONEL VE ATAMA ZAMANI ÖNİZLEME ENTEGRASYONU (04.11.2026)

### 31.1. Kullanıcı Talebi & Gereksinim
- **Kullanıcı Talebi:** Gantt canlı önizleme hover popup kartında ve görev detaylarında; görevi atayan personelin adı ve görevin atandığı tarih/saat bilgisinin açık ve net biçimde gösterilmesi.

### 31.2. Gerçekleştirilen Geliştirmeler
1. **Arka Yüz (Backend) API Zenginleştirmesi (`src/server/index.ts`):**
   - `GET /api/projects/:id/tasks`, `GET /api/tasks/search` ve `GET /api/tasks/personal` uçlarında dönen her görev nesnesi `assigned_by_user_id`, `assigned_by_name` ve `assigned_at` alanlarıyla zenginleştirildi (`task.assigned_by_user_id` -> `task_assignments` geçmişi -> `project.created_by_user_id` -> `Proje Yetkilisi` zincirleme çözümleme).
   - `GET /api/tasks/:id/details` ucunda `safeAssigner` nesnesi atama tarihi (`assigned_at`) ile birlikte garanti altına alındı.
2. **Ön Yüz (Frontend) Entegrasyonu (`src/public/app.js`):**
   - Türkçe tarih ve saat biçimlendirici `formatDateTimeTR(isoStr)` fonksiyonu eklendi (`GG.AA.YYYY SS:dd`).
   - Gantt hover önizleme kartında (`showGanttTaskHoverPopup`) `📁 Proje` ve `👤 Görev Sahibi` satırlarının hemen altına:
     - `🎯 Görevi Atayan`: Görevi atayan yetkilinin adı (örn: Musa Bey, Gürol Sarıoğlu).
     - `⏰ Atama Zamanı`: Atamanın gerçekleştirildiği tarih ve saat (örn: 25.10.2026 09:00).
   - Görev detay çekmecesinde (`openTaskDrawer`), `wpAssignerRow` içerisine atama zamanı eklendi.
3. **Doğrulama:**
   - `npm test` ile 33 kabul testi eksiksiz geçti.
   - `npm run build` ile TypeScript derlemesi ve statik dosya senkronizasyonu hatasız tamamlandı.

---

## 32. GANTT ZAMAN ÇİZELGESİ ÇUBUKLARINDA İŞ ADIMI VE ÇİFT SATIRLI OKUNURLUK DÜZENLEMESİ (04.11.2026)

### 32.1. Kullanıcı Talebi & Problem Tespiti
- **Problem:** Zaman Çizelgesi (Gantt) sağ panosundaki renkli görev çubuklarında yalnızca görev başlığı (`AAAAA`) yer alıyor, sol tablodaki iş adımı etiketi (`KOLEKSİYON OLUŞTURMA`) çubukta yazmıyordu. Ayrıca kısa süreli görevlerde çubuk eni dar kaldığından tarihler (`04.11.2026 - 10.11.`) kırpılıyor ve okunmuyordu.
- **Kullanıcı Talebi:** İş adımının (`KOLEKSİYON OLUŞTURMA`) çubuk üzerine eklenmesi, metin uzunluğuna göre fontun otomatik küçültülerek bir alt satıra geçilmesi, çubuk eninin okunabilirliği sağlayacak şekilde genişletilmesi ve tüm tarih/ilerleme bilgilerinin kesintisiz okunabilir hale getirilmesi.

### 32.2. Gerçekleştirilen Mimari & Arayüz Geliştirmeleri
1. **Çift Satırlı Çubuk Mimarisi (`src/public/app.js`, `src/public/styles.css`):**
   - `.gantt-pill-bar` yüksekliği `42px`'e, satır izleri (`.gantt-row-track` ve sol tablodaki `.g-table-row`) kusursuz hizalama ve dikey senkronizasyon için `54px`'e çıkarıldı.
   - **Üst Satır (`.pill-row-top`):** Görev ikonu (`📌`/`🐞`), renklendirilmiş İş Adımı Etiketi (`.pill-step-tag`, örn: `[KOLEKSİYON OLUŞTURMA]`) ve Görev Başlığı (`.pill-title`, örn: `AAAAA`).
   - **Alt Satır (`.pill-row-bottom`):** İlerleme yüzdesi rozeti (`%0` / `%100`) ve tam tarih aralığı (`📅 04.11.2026 - 10.11.2026`).
2. **Otomatik Dinamik Font Boyutlandırma:**
   - İş adımı ve görev tanımı toplam uzunluğu hesaplanarak `font-compact-sm` (0.67rem) ve `font-compact-xs` (0.61rem) sınıfları otomatik uygulanarak metinlerin taşması önlendi.
3. **Dinamik Genişlik ve Kesintisiz Okunurluk (`minBarWidth`):**
   - Çubuğun asgari genişliği (`min-width`) en az 250px olarak güvenceye alındı; metin uzadıkça dinamik genişleme katsayısı entegre edildi.
   - Böylece kısa terminli görevlerde dahi tarihler ve iş adımı asla sağdan kesilmeden tam okunur hale getirildi.
4. **Test ve Doğrulama:**
   - 33/33 kabul testi başarıyla geçti, TypeScript derlemesi 0 hata ile tamamlandı.

---

## 35. ALT MODALLARIN (İŞ ADIMI VE GÖREV TANIMI EKLE) ÜST KATMAN (Z-INDEX) VE YIĞIN DÜZENLEMESİ (04.11.2026)

### 35.1. Kullanıcı Talebi & Problem Tespiti
- **Problem:** "Yeni Görev Ekle" modalı (`#taskModal`) açıkken `+ Yeni Adım Ekle` veya `+ Yeni Tanım Ekle` butonlarına tıklandığında açılan "Yeni İş Adımı Tanımla" (`#newWorkflowStepModal`) veya "Yeni Görev Tanımı Ekle" (`#newTaskDefModal`) pencereleri, `#taskModal`'ın arkasında kalıyordu. Kullanıcı ancak birinci modalı kapattığında ikinci modalı görebiliyordu.
- **Kök Neden:**
  1. Her iki alt modal HTML içerisinde sidebar'ın hemen bitimine (DOM'un üst kısmına, satır 199 civarına) yerleştirilmişti, `#taskModal` ise satır 1293'te (DOM'un alt kısmında) yer alıyordu.
  2. Bütün modallar `.modal-backdrop` sınıfı ile aynı `z-index: 100` değerine sahipti. Aynı `z-index` seviyesinde DOM'da sonra gelen eleman önde boyandığından `#taskModal` alt modalları tamamen örtüyordu.

### 35.2. Gerçekleştirilen Mimari & Arayüz Düzeltmeleri
1. **DOM Konumu Düzeltildi (`src/public/index.html`):**
   - `#newWorkflowStepModal` ve `#newTaskDefModal`, sidebar bloğundan çıkarılıp ana modallar bölgesine (`#taskModal`'ın hemen ardına) taşındı.
2. **Üst Katman Z-Index Güvencesi (`src/public/styles.css`):**
   - `#newWorkflowStepModal` ve `#newTaskDefModal` pencereleri için `z-index: 300 !important;` ve `.modal-content` için `z-index: 301 !important;` tanımlandı.
   - Böylece `+ Yeni Adım Ekle` veya `+ Yeni Tanım Ekle` butonuna basıldığında diyalog penceresi `#taskModal`'ın doğrudan en üstünde ve odağında açılır hale getirildi.
   - Yeni adım/tanım eklendiğinde veya iptal edildiğinde alt modal kapanıp doğrudan arkasındaki `#taskModal`'a dönülmekte ve yeni veri anında seçili hale gelmektedir.
3. **Doğrulama:**
   - 33/33 kabul testi başarıyla geçti.
   - `npm run build` ile TypeScript derlemesi 0 hata ile tamamlandı.


### 34.1. Kullanıcı Talebi & Problem Tespiti
- **Problem:** "Yeni Görev Ekle" modalında "Görev Tanımı" açılır menüsündeki metinler uzun olduğunda menü modal penceresinin sağ tarafından dışarıya taşıyordu.
- **Kullanıcı Talebi:**
  1. Görev Tanımı açılır kutusundaki sağa taşma sorununun giderilmesi.
  2. Standart tekstil iş akışı görev tanımlarının sisteme eklenmesi:
     - `AW27 koleksiyonun eksiklerini oluşturma`
     - `Tasarım ve satış departmanının beklentisi doğrultusunda kumaşların organize edilmesi`
     - `Koleksiyonun teknik çizimlerinin hazırlanması`
     - `Koleksiyon model hazırlığı yıkamaların belirlenmesi`
     - `Modellerin kalıp departmanına aktarılması`
     - `Modellerin dikim departmanına aktarılması`
     - `Modellerin yıkama bölümüne aktarılması`
     - `Modellerin finish bölümüne aktarılması`
  3. AW27 kodunun sezon bazlı (SS27, AW28 vb.) değişebilmesi sebebiyle Proje Yöneticisinin hem standart tanımları seçebilmesi hem de özel sezon tanımları girebilmesi ve yeni tanımları kataloğa ekleyebilmesi.

### 34.2. Gerçekleştirilen Mimari & Arayüz Geliştirmeleri
1. **Modal Genişliği ve CSS Grid Taşma Koruması (`src/public/index.html`, `src/public/styles.css`):**
   - `#taskModal .modal-content` azami genişliği `520px`'ten `680px`'e çıkarıldı (`width: 95%`).
   - `#tWorkflowAndDefRow` düzeni `grid-template-columns: 1fr 1.35fr` olarak kurgulandı ve CSS Grid taşmasını önlemek için her iki sütuna `min-width: 0;` uygulandı.
   - Açılır kutulara (`#tWorkflowStep`, `#tTaskDefinition`) `width: 100%; max-width: 100%; text-overflow: ellipsis; overflow: hidden; box-sizing: border-box;` özellikleri tanımlanarak menünün modal dışına taşması kesin olarak engellendi.
2. **Standart Tekstil Tanımları ve Sezonluk Özel Tanım Desteği (`src/public/app.js`):**
   - 8 adet standart tekstil üretim tanımı sisteme entegre edildi.
   - Açılır listede seçili iş adımına özel tanımlar (`⭐ [Adım] Adımına Özel Tanımlar`) en başta gösterilirken, diğer adımlara ait tanımlar da (`📋 Diğer Standart Tekstil Görev Tanımları`) listelendi.
   - Farklı bir adımın tanımı seçildiğinde, sistem iş adımını otomatik olarak o adıma geçirip ilgili departman personelini önerir hale getirildi.
   - `✍️ Farklı / Özel Tanım Yaz (Sezon Kodu vb.)...` seçeneği ile proje yöneticisinin AW27, SS27 gibi sezonluk kodları ve özel tanımları serbestçe girebileceği giriş alanı hazırlandı.
3. **Proje Yöneticisi Yetkilendirme Güvencesi (`src/server/index.ts`, `src/public/app.js`):**
   - Backend `POST /api/task-definitions` ve `POST /api/workflow-steps` endpoint'lerinde, kullanıcının proje yöneticisi veya proje oluşturucusu olması durumunda kataloğa yeni tanım eklemesine tam yetki tanındı.
   - Ön yüzde `+ Yeni Tanım Ekle` butonu proje yöneticileri için görünür ve erişilebilir kılındı.
4. **Test ve Doğrulama:**
   - 33/33 kabul testi başarıyla geçti.
   - `npm run build` ile TypeScript derlemesi 0 hata ile tamamlandı.


---

## 37. ÇOKLU DİL DESTEĞİNE (I18N) UYUMLU DİNAMİK TARİH VE ZAMAN BİÇİMLENDİRMESİ (05.11.2026)

### 37.1. Kullanıcı Talebi & Problem Tespiti
- **Problem:** Projeler kartlarında ("Projeler" görünümü), Gantt zaman çizelgesi çubuklarında, görev detay çekmecesinde ve raporlama ekranlarında tarihler sabit ISO formatında (`2026-11-09 ➔ 2026-11-13`) veya sabit Türkçe yerelinde gösterilmekteydi.
- **Kullanıcı Talebi:** Tarih formatının seçilen dile (Türkçe, İngilizce, Almanca) göre tüm projede otomatik ve tutarlı olarak biçimlendirilmesi (Türkçe'de `GG.AA.YYYY`, İngilizce'de `GG/AA/YYYY`, Almanca'da `GG.AA.YYYY`).

### 37.2. Gerçekleştirilen Mimari & Arayüz Geliştirmeleri
1. **Dinamik Dil ve Tarih Biçimlendiricisi (`formatDate`, `formatDateTime`, `formatTime` - `src/public/app.js`):**
   - UTC/Saat dilimi kaymalarını önleyen sağlam ISO ayrıştırma mantığı ile evrensel tarih biçimlendirici oluşturuldu:
     - **Türkçe (`tr`):** `GG.AA.YYYY` (örn: `09.11.2026`), `GG.AA.YYYY SS:dd`
     - **Almanca (`de`):** `GG.AA.YYYY` (örn: `09.11.2026`), `GG.AA.YYYY, SS:dd`
     - **İngilizce (`en`):** `GG/AA/YYYY` (örn: `09/11/2026`), `GG/AA/YYYY SS:dd`
   - `formatDateTR` ve `formatDateTimeTR` çağrıları dinamik `formatDate` ve `formatDateTime` rotasına bağlandı.
2. **Proje Genelinde Tarihlerin Entegrasyonu:**
   - **Projeler Sayfası (`renderProjectsGrid`):** Kartlardaki `🗓️ Güncel: 09.11.2026 ➔ 13.11.2026` ve ilk plan ipucu metinleri seçili dile uyarlandı.
   - **Görevlerim Sayfası (`renderMyTasks`):** Vade ve gecikme tarihleri seçili dile uyarlandı.
   - **Zaman Çizelgesi (Gantt) (`renderTimeline` & `calculateGanttScale`):** Çubuklar üzerindeki tarihler (`04.11.2026 - 10.11.2026`), sol tablodaki tarih aralıkları ve Gantt zaman çizelgesi üst başlığındaki ay/gün isimleri seçili dile uyarlandı.
   - **Görev Detay Çekmecesi (`openTaskDrawer`):** Başlangıç/bitiş tarihleri, ilk plan karşılaştırması ve plan revizyon geçmişi dinamik tarihlerle güncellendi; form girdi alanları için ISO standardı korundu.
   - **Proje Yönetim Modalı (`openProjectManageModal`):** İlk plan (baz) ve güncel plan tarih karşılaştırması ile plan revizyon logları biçimlendirildi.
   - **Gantt Canlı Hover Kartı (`showGanttTaskHoverPopup`):** Görev zaman planı ve atama zamanı dinamik tarih/saat fonksiyonlarıyla bağlandı.
   - **Bildirimler, Raporlar ve Yedekleme Logları:** Sabit `tr-TR` kodlamaları kaldırılarak `formatDateTime` ve `formatTime` ile standartlaştırıldı.
3. **Anında Canlı Yenileme (`setLanguage`):**
   - Dil seçiciden (`TR`, `EN`, `DE`) dil değiştirildiğinde, aktif sayfa (Projeler, Gantt, Kanban, Görevlerim vb.) anında yeniden çizilerek tüm tarihlerin ve etiketlerin anlık olarak yeni dilde güncellenmesi sağlandı.
4. **Test ve Doğrulama:**
   - **33/33 Kabul Testi (`npm test`)** başarıyla geçti.
   - **TypeScript Derlemesi (`npm run build`)** 0 hata ile tamamlandı.


### 36.1. Kullanıcı Talebi & Problem Tespiti
- **Problem:** "Görevlerim" sayfasında çok sayıda görev listelendiğinde ve kullanıcı mouse tekerleğiyle sayfayı aşağı kaydırdığında, tüm sayfa gövdesi (`body`) kaydığı için sol kenar çubuğunun (Sidebar) üst kısmı yukarı doğru kayboluyor, sol altta yer alan profil ("Sistem Yöneticisi"), dil seçici ve tema düğmesi ise ekranın ortasında havada asılı kalıp altı boşluk oluyordu.
- **Kullanıcı Talebi:**
  1. Mouse tekerleğiyle görevler kaydırıldığında, sol sidebar ve "Sistem Yöneticisi" kartının ekranın altında sabit (çakılı) kalması.
  2. Farklı ekran boyutlarına sahip cihazlardan (küçük ekranlı laptoplar, geniş masaüstü monitörler, tabletler ve telefonlar) erişildiğinde simetrinin ve yerleşimin bozulmaması, her cihaza tam uyum sağlaması.

### 36.2. Gerçekleştirilen Mimari & Arayüz Çözümleri
1. **Pencereli SPA Shell Mimarisi (`src/public/styles.css`):**
   - `html, body` öğelerine `height: 100%; height: 100dvh; overflow: hidden;` tanımlanarak tarayıcının tüm sayfayı kaydırması engellendi.
   - `.app-layout` ve `.app-main-area` katmanları `height: 100%; height: 100dvh; overflow: hidden;` şeklinde kurgulandı.
2. **Sabit ve Bağımsız Sol Kenar Çubuğu (`.app-sidebar`):**
   - Sol kenar çubuğu `height: 100%; height: 100dvh; display: flex; flex-direction: column; overflow: hidden;` yapısına kavuşturuldu.
   - Üst logo alanı (`.sidebar-brand`) `flex-shrink: 0;` ile en üste sabitlendi.
   - Menü listesi (`.sidebar-nav`) `flex: 1; min-height: 0; overflow-y: auto;` yapılarak, küçük ekranlı laptoplarda dahi menü öğelerinin kendi içinde kayabilmesi sağlandı.
   - Alt profil ve ayar alanı (`.sidebar-footer`), `flex-shrink: 0; margin-top: auto;` ile sol alt köşeye kalıcı olarak kilitlendi. Böylece görevler ne kadar uzun olursa olsun "Sistem Yöneticisi" kartı ekranın en altında sabit kalır, asla yukarı kaymaz.
3. **Bağımsız İçerik Kaydırma Alanı (`.view-section`):**
   - `.view-section` alanına `flex: 1; min-height: 0; height: 100%; overflow-y: auto;` eklendi.
   - Mouse tekeri ile kaydırma yapıldığında yalnızca sağdaki görevler/içerikler akar; sol menü ve üst araç çubuğu (`.main-topbar`) tamamen sabit kalır.
4. **Mobil & Tablet Desteği (`src/public/index.html`, `src/public/app.js`):**
   - 850px altındaki cihazlar (tablet & telefonlar) için üst araç çubuğuna açılır-kapanır mobil hamburger menü butonu (`#mobileMenuToggleBtn`) ve arka plan karartması (`#sidebarMobileBackdrop`) entegre edildi.
   - Menü öğelerine tıklandığında çekmece menü otomatik kapanır.
5. **Doğrulama:**
   - 33/33 kabul testi başarıyla geçti.
   - `npm run build` ile derleme hatasız tamamlandı.

---

## 38. ÜST MENÜ PROJE SEÇİCİSİNDE KİŞİSEL TO-DO DESTEĞİ VE KANBAN ENTEGRASYONU (05.11.2026)

### 38.1. Kullanıcı Talebi & Problem Tespiti
- **Problem:** Üst araç çubuğundaki Proje seçici açılır menüsünde (`#projectSelect`) yalnızca şirket projeleri listelenmekteydi. Kullanıcı Kanban İş Panosundayken bireysel / kişisel to-do görevlerini seçip görüntüleyemiyordu.
- **Kullanıcı Talebi:** Kişisel to-do'ların proje seçicisinden seçilebilmesi ve seçildiğinde Kanban İş Panosunda (Yapılacak/Bekliyor, Devam Ediyor, Tamamlandı) sütunlarında canlı gösterilmesi.

### 38.2. Gerçekleştirilen Mimari & Arayüz Geliştirmeleri
1. **Üst Seçicide Optgroup Mimarisi (`src/public/app.js`):**
   - `#projectSelect` açılır kutusu iki mantıksal gruba ayrıldı:
     - `📁 Şirket Projeleri`: Proje listesi (`2027 İlkbahar/Yaz Tekstil...`, `DENEME -2`, `TEST PROJE`).
     - `👤 Bireysel Alan`: `👤 Kişisel To-Do'larım` seçeneği (`value="personal"`).
   - Dil değişiminde (`setLanguage`) bu optgroup başlıklarının ve seçeneklerin de anında seçilen dile (`TR`, `EN`, `DE`) çevrilmesi sağlandı.
2. **Kişisel Görevlerin Kanban İş Panosu ile Entegrasyonu (`renderBoard`):**
   - Proje seçiciden `👤 Kişisel To-Do'larım` seçildiğinde:
     - Yalnızca kullanıcının kişisel / projesiz görevleri filtrelenir.
     - Kartlarda `👤 Kişisel To-Do` rozeti (`.board-card-type.personal`, mor renkli rozet) gösterilir.
     - Görevler mevcut durumlarına göre `Yapılacak / Bekliyor`, `Devam Ediyor` ve `Tamamlandı` sütunlarında listelenir.
     - Kullanıcı kişisel görev kartlarını sütunlar arasında fareyle sürükleyip bırakarak (`drag-and-drop`) durumlarını anında güncelleyebilir.
     - Kartlara tıklandığında görev detay çekmecesi açılır, "+ Hızlı Görev Ekle" tıklandığında ise doğrudan kişisel to-do şablonu varsayılan olarak gelir.
3. **Zaman Çizelgesi (Gantt) Uyumu (`renderTimeline`):**
   - `👤 Kişisel To-Do'larım` seçildiğinde Gantt başlığı `👤 Kişisel To-Do'larım` olarak güncellenir ve kullanıcının kişisel işleri zaman çizelgesinde de incelenebilir.
4. **Doğrulama ve Test:**
   - **33/33 Kabul Testi (`npm test`)** başarıyla geçti.
   - **TypeScript Derlemesi (`npm run build`)** 0 hata ile tamamlandı.

---

## 39. GANTT TABLOSU TAM TARİH GÖRÜNÜMÜ VE AÇIKLAMAYA GÖRE OTOMATİK GENİŞLEYEN ORANTILI ZAMAN ÇUBUKLARI (05.11.2026)

### 39.1. Kullanıcı Talebi & Problem Tespiti
- **Sol Tablo Tarih Sütunu:** Zaman Çizelgesi (Gantt) sol tablosunda "TARİH ARALIĞI" sütununda tarihler dar genişlik (110px) nedeniyle üç nokta ile kesilmekteydi (`09.11.2026 - ...`). Kullanıcı başlangıç ve bitiş tarihlerinin kesilmeden eksiksiz görünmesini istedi.
- **Zaman Çubukları (Gantt Bars):** Kısa süreli (1-2 günlük) görevlerin zaman çubukları 44px - 88px gibi dar kutulara sıkışıyor ve içindeki görev tanımı/açıklaması ile tarihler (`KOLEK... 0% 📅 C...`) okunamaz hale geliyordu. Kullanıcı, bu nesnelerin uzunluklarının içindeki açıklamalara göre otomatik olarak genişlemesini, aynı zamanda gün, hafta, ay ve yıl görünümlerinde uzunlukların görev süreleriyle orantılı olarak genişlemesini talep etti.

### 39.2. Gerçekleştirilen Geliştirmeler
1. **Sol Tablo Panel Genişliği & Tam Tarih Gösterimi (`src/public/styles.css`):**
   - Sol tablo paneli `.op-gantt-table-pane` varsayılan genişliği `460px`'ten `580px`'e (min-width `340px`, max-width `900px`) çıkarıldı.
   - "TARİH ARALIĞI" sütunu `.g-col-dates` genişliği `180px` (min-width `180px`, `flex-shrink: 0`, `white-space: nowrap`) olarak ayarlandı.
   - `09.11.2026 - 10.11.2026` gibi çift tarih aralıkları hiçbir kırpılma olmadan eksiksiz gösterildi.
   - Sol tablodaki `#` (34px), `Durum` (100px), `Atanan` (110px) sütunları optimize edildi, görev başlığı için ferah alan sağlandı.
   - Görev başlığında mükerrer yazılan `[İŞ ADIMI]` öneki temizlendi (`displayTitle`), sol tabloda ve bar üzerinde temiz metin sunuldu.
2. **Görev Barı İçerik Genişliği Hesaplayıcı (`getTaskContentWidth`):**
   - Görevin başlık uzunluğu, iş adımı rozetinin genişliği, ikon ve alt satırdaki `% ilerleme + 📅 başlangıç - bitiş` rozetinin gerektirdiği gerçek piksel genişliğini hesaplayan `getTaskContentWidth(task)` fonksiyonu eklendi.
   - Bar nesneleri için minimum `260px` taban genişlik güvenceye alındı; uzun başlıklarda (örn. 50-70 karakterlik tekstil tanımlarında) çubuk otomatik olarak 350px-600px'e kadar genişleyecek şekilde dinamik kılındı.
3. **Çoklu Zoom Seviyelerinde Orantılı Genişleme (`src/public/app.js`):**
   - **Günlük (Day):** Sütun genişliği `48px`. Süreye göre ek genişleme çarpanı `(durationDays - 1) * 22px`.
   - **Haftalık (Week):** Sütun genişliği `90px`. Süreye göre ek genişleme çarpanı `(durationWeeks - 1) * 36px`.
   - **Aylık (Month):** Sütun genişliği `120px`. Süreye göre ek genişleme çarpanı `(durationMonths - 1) * 50px`.
   - **Yıllık (Year):** Sütun genişliği `110px`. Süreye göre ek genişleme çarpanı `(durationQuarters - 1) * 60px`.
   - Böylece hem içerik asla kesilmez/ezilmez, hem de daha uzun süren görevler kısa olanlara kıyasla görünür biçimde orantılı olarak daha uzun çubuklarla temsil edilir.
4. **Dinamik Timeline Genişliği & Izgara Uyumlaması (`effectiveTimelineWidth`):**
   - Otomatik genişleyen barların sağ tarafta takvim ızgarası dışına taşmaması için `effectiveTimelineWidth = Math.max(scale.timelineWidth, maxBarRight)` formülü uygulandı.
   - `scrollWrap`, `header`, `rowsContainer`, `gridLines`, `svgOverlay` ve her satır izi (`track`) bu dinamik genişliğe uyarlandı.
   - `calculateGanttScale` içinde bitiş tampon günleri (günlük için +25 gün, haftalık için +42 gün, aylık için +6 ay, yıllık için +2 yıl) genişletilerek sağ taraf ızgara çizgilerinin kesintisiz devam etmesi sağlandı.
5. **Doğrulama ve Test:**
   - **33/33 Kabul Testi (`npm test`)** başarıyla geçti.
   - **TypeScript Derlemesi (`npm run build`)** 0 hata ile tamamlandı.







