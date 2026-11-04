# 📘 FG Group Proje & Görev Yönetim Sistemi — Sistem Yöneticisi (Admin) Kullanım Kılavuzu

**Hedef Kitle:** Sistem Yöneticileri, Bilgi İşlem / IT Yöneticileri, Üst Düzey Yönetim  
**Erişim Kapsamı:** Tam Yetki (Sistem Ayarları, Ekip Yönetimi, E-posta Entegrasyonu, Yedekleme & Kurtarma, Tüm Projeler)

---

## 📑 İçindekiler
1. [Giriş ve Genel Bakış](#1-giriş-ve-genel-bakış)
2. [Ekip & Personel Yönetimi](#2-ekip--personel-yönetimi)
   - [Yeni Personel Tanımlama ve Otomatik Karşılama E-postası](#yeni-personel-tanımlama)
   - [Personel Hesabını Dondurma (İşten Ayrılma / Güvenlik Engeli)](#personel-hesabını-dondurma)
   - [Yetkilendirme Seviyeleri (Proje Açma & Rapor Oluşturma)](#yetkilendirme-seviyeleri)
3. [E-posta & Otomatik Raporlama Modülü (Exchange Online / M365)](#3-e-posta--otomatik-raporlama-modülü)
   - [SMTP ve Port Yapılandırması](#smtp-ve-port-yapılandırması)
   - [AES-256-GCM Şifre Kasası Güvenliği](#aes-256-gcm-şifre-kasası-güvenliği)
   - [Outlook Actionable Cards v1.4 Mekanizması](#outlook-actionable-cards-v14-mekanizması)
   - [Zamanlanmış Otomatik İlerleme Raporları](#zamanlanmış-otomatik-ilerleme-raporları)
4. [Yedekleme & Felaket Kurtarma (Disaster Recovery)](#4-yedekleme--felaket-kurtarma)
   - [Otomatik Günlük ve Haftalık Yedekleme Planı](#otomatik-yedekleme-planı)
   - [Tek Tıkla Anlık Yedek Alma ve SHA-256 Mühürleme](#tek-tıkla-anlık-yedek-alma)
   - [Tekil Proje Kurtarma (İzole Restorasyon)](#tekil-proje-kurtarma)
   - [Tam Sistem Geri Yükleme ve Otomatik Güvenlik Yedeği (Pre-Restore Safety)](#tam-sistem-geri-yükleme)
5. [Görev Müdahale İzolasyonu ve Güvenlik İlkeleri](#5-görev-müdahale-izolasyonu)

---

## 1. Giriş ve Genel Bakış
FG Group Proje & Görev Yönetim Sistemi, kurumsal çoklu kiracılı (multi-tenant) yapıda, DAG bağımlılık algoritmalarıyla çalışan, görev gecikmelerini ve personel performansını şeffaf bir şekilde yöneten bir platformdur. 

Sistem Yöneticisi (`ADMIN`), sol menüdeki **Yönetim** başlığı altındaki kritik modüllere tam erişime sahiptir:
- 👥 **Ekip & Personel:** Şirket çalışanlarının hesapları, rolleri ve erişim durumları.
- 📧 **E-posta & Otomatik Rapor:** Microsoft 365 Exchange SMTP entegrasyonu ve otomatik rapor planları.
- 🛡️ **Yedekleme & Kurtarma:** Sistemin felaket kurtarma ve iş sürekliliği merkezi.

---

## 2. Ekip & Personel Yönetimi

### Yeni Personel Tanımlama
1. Sol menüden **Ekip & Personel** modülüne tıklayın.
2. Sağ üstteki **"+ Yeni Personel Ekle"** butonuna basın.
3. Personelin adını, e-posta adresini, departmanını, telefonunu ve ülkesini girin.
4. Kaydet butonuna bastığınızda:
   - Kullanıcı hesabı oluşturulur.
   - Sistem personelin e-posta adresine zengin tasarımlı **Hoş Geldiniz Kartı** gönderir (giriş URL'i ve başlangıç şifresi ile birlikte).

### Personel Hesabını Dondurma (İşten Ayrılma / Güvenlik Engeli)
Şirketten ayrılan veya erişimi askıya alınması gereken personeller için:
1. Personel listesinde ilgili satırdaki **"⏸️ Dondur"** butonuna tıklayın.
2. Açılan pencerede onay verin.
3. Sonuçlar:
   - Personel sisteme artık giriş yapamaz (HTTP 403 ve arayüzde kırmızı uyarı).
   - Yeni görev veya proje oluşturulurken seçici listesinde "(Devre Dışı / Ayrıldı)" etiketiyle kilitlenir.
   - İstenirse tek tıkla **"▶️ Aktifleştir"** butonuyla hesabı tekrar açılabilir.

### Yetkilendirme Seviyeleri
- **Proje Oluşturabilir (`can_create_project`):** Standart personelin yeni şirket projeleri açıp açamayacağını belirler. Kapalıysa personel yalnızca kendisine atanmış görevleri ve bireysel to-do'larını yönetebilir.
- **Özel Rapor Üretebilir (`can_build_reports`):** Sürükle-bırak dinamik rapor motorunu kullanma yetkisi verir.

---

## 3. E-posta & Otomatik Raporlama Modülü

### SMTP ve Port Yapılandırması
1. Sol menüden **E-posta & Otomatik Rapor** sekmesini açın.
2. Exchange / M365 ayarlarınızı girin:
   - **SMTP Sunucusu:** `smtp.office365.com`
   - **Port:** `587` (STARTTLS)
   - **Kullanıcı Adı / E-posta:** Kurumsal servis adresi (örn. `notification@fggroup.com.tr`)
   - **Parola:** M365 uygulama şifresi.
3. **"Bağlantıyı Test Et"** butonuyla test kartı göndererek kurulumu doğrulayın.

### AES-256-GCM Şifre Kasası Güvenliği
Girdiğiniz SMTP parolası veritabanında asla açık metin (cleartext) saklanmaz. Donanım anahtarı türetme (HKDF) ve **AES-256-GCM** şifreleme kasası ile mühürlenir. Sistem yeniden başlatılsa bile parola güvenle korunur.

### Outlook Actionable Cards v1.4
Sistem personellere gönderdiği e-postalarda standart metin yerine Microsoft Outlook ile tam uyumlu interaktif kartlar gönderir:
- **Görev Atandı:** Görevin aciliyeti, öncülleri ve termin tarihi kart içinde gösterilir.
- **Sıra Sizde (Bağımlılık Açıldı):** Öncülü biten personelin e-postasına tek tıkla görevi açma bağlantısı düşer.
- **Zorunlu Notlu İlerleme:** Personel %40-%60 güncellemesi yaptığında yöneticilerin e-postasına yapılan işi anlatan özet kart iletilir.

---

## 4. Yedekleme & Felaket Kurtarma (Disaster Recovery)

### Otomatik Yedekleme Planı
1. **Yedekleme & Kurtarma** modülünde **"Zamanlanmış Otomatik Yedekleme Ayarları"** kartını açın.
2. **Günlük Yedek:** Saati belirleyin (örn. `03:00`). Saklama süresi (varsayılan 14 gün) sonunda eski günlük yedekler otomatik temizlenir.
3. **Haftalık Arşiv:** Günü ve saati seçin (örn. Pazar `04:00`). 8 haftaya kadar arşivlenir.
4. **Yönetici Bilgilendirme E-postası:** Her otomatik yedek sonrası durum e-posta ile raporlanır.

### Tek Tıkla Anlık Yedek Alma
Plan dışı önemli bir revizyondan veya veri aktarımından önce **"🛡️ Şimdi Manuel Yedek Al"** butonuna basın. Yedek anında oluşturulur ve kriptografik **SHA-256 hash** imzası üretilerek depolanır.

### Tekil Proje Kurtarma (İzole Restorasyon)
Eğer bir personel yanlışlıkla tek bir projedeki görevleri siler veya bozarsa, **tüm şirketin verisini geri almak zorunda değilsiniz**:
1. Yedek tablosunda **"🔍 İncele / Tek Proje Kurtar"** butonuna tıklayın.
2. Yedeğin içindeki projelerden yalnızca hasar gören projeyi seçin.
3. **"Seçili Projeyi Kurtar"** deyin.
4. Diğer projeler, yeni açılan görevler ve çalışanların son kayıtları **hiç bozulmadan** yalnızca o proje eski haline döndürülür.

### Tam Sistem Geri Yükleme ve Güvenlik Yedeği (Pre-Restore Safety)
Sunucu çökmesi veya büyük veri kaybı durumunda:
1. İstediğiniz yedeğin yanındaki **"🔄 Tam Geri Yükle"** butonuna basın.
2. Sistem geri yüklemeye başlamadan **tam 1 saniye önce** mevcut anlık durumun otomatik `PRE_RESTORE_SAFETY` yedeğini alır. Yanlış yedeği seçseniz dahi saniyeler içinde geri dönebilirsiniz!

---

## 5. Görev Müdahale İzolasyonu ve Güvenlik İlkeleri
Sistemde **hiçbir kullanıcı başkasının yerine görev başlatamaz veya tamamlayamaz**:
- Admin dahil olmak üzere yöneticiler personelin görev tanımını, önceliğini ve planını revize edebilir; ancak **görevi fiilen icra etme (başlatma, ilerletme, tamamlama)** yetkisi yalnızca atanan personele aittir.
- Bu kural veri manipülasyonunu engeller ve performans ölçümlerinin (`RAP04` formülü) adil olmasını garanti eder.
