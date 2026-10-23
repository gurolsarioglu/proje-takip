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
- [/] **Adım 7:** Kullanıcı Talepleri (istekler/1.jpg & 2.jpeg):
  - **X Ekseni Gün Takvimi:** Ay isimleri ve gün numaraları (1, 2, ... 31) x ekseninde sütunlar olarak gösterilecek.
  - **Tarih Formatı:** Barların içindeki tarihler `GG.AA.YYYY` formatında yazılacak.
  - **Ok İşareti ile Bağımlılık Bağlantısı (Resim 2 Örneği):** Öncül görevden ardıl göreve giden kavisli SVG ok çizgisi ile görevler birbirine bağlanacak.
  - **Gantt İçi Görev Kartları:** İlerleme yüzdesi, durum rozeti ve ikonlarla resim 2 kalitesinde modern görünüm.
- [ ] **Adım 8:** Tarayıcı Testleri ve Canlı Onay.

---

## 4. Değişiklik ve Karar Günlüğü (Changelog)

### [23 Ekim 2026 - 13:50] - Sadeleştirilmiş Arayüz & Testler Tamamlandı
* **14/14 Kabul Testi Geçti:** Multi-tenant ayrımı, döngü engelleme (DAG), gecikme tespiti, otomatik dil seçimi ve personel yetkilendirmesi test edildi.
* **Görsel Arayüz Canlıya Alındı:** 
  - `Görevlerim`: Tek tıkla görev tamamlama, bekleme gerekçesi girişi, durum etiketleri.
  - `Projeler`: İlerleme yüzdeleri ve tarih kartları.
  - `Zaman Çizelgesi (Gantt)`: Yatay zaman çubukları ve öncül ilişkileri.
  - `İş Panosu (Kanban)`: 3 sütunlu temiz pano.
  - `Ekip & Personel`: Personel kartı görünümü ve tek tıkla "Proje Açma İzni" yetkilendirmesi.
* **Almanca / İngilizce Otomatik Dil Geçişi:** `hans@fggroup.com.tr` ile giriş yapıldığında arayüzün anında Almanca'ya dönüştüğü ve izinli olmadığı için proje açma butonunun gizlendiği doğrulandı.
