# 🗺️ FG Group Proje & Görev Yönetim Sistemi — Tam Görsel Mimari, İş Akışı ve Yetki Şeması (`tam_sema.md`)

Bu doküman, **FG Group Proje ve Görev Yönetim Sistemi**'nin tüm ekranlarını, modüllerini, arka plan motorlarını, kullanıcı yetki sınırlarını ve iş akışlarını tek bakışta görebilmeniz; mevcut yapıyı inceleyip eksik veya yeni taleplerinizi kolayca belirleyebilmeniz için hazırlanmıştır.

---

## 🖼️ 1. Genel Mimari ve İş Akışı İnfografik Posterleri

### 1.1. Sistem Mimarisi ve 8 Ana Modül Haritası
![FG Group Genel Sistem Mimarisi İnfografiği](./docs/fg_group_sistem_mimarisi_infografik.jpg)

---

### 1.2. Kullanıcı Rolleri, Görev Yaşam Döngüsü ve Yetki İzolasyonu Akışı
![FG Group Kullanıcı Rolleri ve Görev Yaşam Döngüsü](./docs/fg_group_is_akisi_ve_yetki_semasi.jpg)

---

## 🏛️ 2. Üç Katmanlı Modüler Sistem Şeması

Sistem **birbirini bozmayan bağımsız modüller** halinde 3 katmandan oluşur:
1. **Sunum Katmanı (`src/public/`):** Sol menüdeki 8 bağımsız ekran ve modallar.
2. **İş Mantığı Servis Katmanı (`src/modules/`):** Her biri kendi işinden sorumlu 10 bağımsız servis motoru.
3. **Veri, Kasa ve Yedekleme Katmanı (`src/database/` & `src/core/`):** PostgreSQL veritabanı, AES-256-GCM şifre kasası ve SHA-256 mühürlü yedek deposu.

```mermaid
flowchart TD
    subgraph UI["🖥️ 1. KULLANICI & YÖNETİCİ EKRANLARI (Sol Menüdeki 8 Ana Modül)"]
        direction LR
        subgraph WORKSPACE["ÇALIŞMA ALANI (Tüm Kullanıcılar - Yetkiye Göre)"]
            V1["📋 1. Görevlerim & Kişisel To-Do"]
            V2["📁 2. Projeler & Ekip Yönetimi"]
            V3["📅 3. Zaman Çizelgesi (Gantt)"]
            V4["📊 4. İş Panosu (Kanban)"]
            V5["📈 5. Özel Raporlar (Sürükle-Bırak)"]
        end
        subgraph ADMIN_PANEL["YÖNETİM ALANI (Yalnızca Admin)"]
            V6["👥 6. Ekip & Personel"]
            V7["📧 7. E-posta & Otomatik Rapor"]
            V8["🛡️ 8. Yedekleme & Kurtarma"]
        end
    end

    subgraph SERVICES["⚙️ 2. ARKA PLAN SERVİS MOTORLARI (src/modules/*)"]
        S_AUTH["🔐 AuthService\n(Giriş, Profil, Hesap Dondurma)"]
        S_PROJ["📁 ProjectService\n(Proje İzolasyonu, Üyeler, Revizyon)"]
        S_TASK["📌 TaskService\n(Görev Müdahale Koruma & İcra İzolasyonu)"]
        S_DAG["🕸️ DependencyService\n(DAG Döngü Engeli & Kilit Açma)"]
        S_DELAY["⏱️ DelayService\n(Gecikme Tespiti & Zorunlu Gerekçe)"]
        S_REP["📊 ReportingService\n(Performans Puanı & Muafiyet)"]
        S_NOTIF["🔔 NotificationService\n(Mükerrerlik Önleyici Bildirim)"]
        S_TODO["☑️ MicrosoftTodoService\n(MS Graph Çift Yönlü Eşitleme)"]
        S_MAIL["📧 EmailAndAutomationService\n(Exchange SMTP & Adaptive Cards)"]
        S_BACKUP["🛡️ BackupAndRecoveryService\n(Otomatik Plan & Tekil Proje Kurtarma)"]
    end

    subgraph STORAGE["🗄️ 3. VERİTABANI, ŞİFRE KASASI VE FELAKET KURTARMA KATMANI"]
        DB_PG["🐘 PostgreSQL Motoru\n(Harici PostgreSQL / Gömülü PGlite 18.6)"]
        VAULT["🔒 CryptoVault (AES-256-GCM)\n(Şifreli SMTP Kasası)"]
        BACKUPS["📦 Yedek Deposu (.work/backups/)\n(SHA-256 Bütünlük Korumalı JSON)"]
    end

    V1 --> S_TASK
    V1 --> S_TODO
    V2 --> S_PROJ
    V3 --> S_TASK
    V3 --> S_DAG
    V4 --> S_TASK
    V4 --> S_DAG
    V5 --> S_REP
    V6 --> S_AUTH
    V7 --> S_MAIL
    V8 --> S_BACKUP

    S_TASK --> S_DAG
    S_TASK --> S_DELAY
    S_TASK --> S_MAIL
    S_DAG --> S_NOTIF
    S_DAG --> S_MAIL
    S_PROJ --> DB_PG
    S_TASK --> DB_PG
    S_MAIL --> VAULT
    S_BACKUP --> BACKUPS
    S_BACKUP --> DB_PG
```

---

## 🔒 3. Görev Müdahale Koruması ve İcra İzolasyonu (Kim Ne Yapabilir?)

Hiçbir kullanıcı bir başkasının görevine müdahale edemez. Sorumluluk ve yetki sınırları katı bir şekilde izole edilmiştir:

```mermaid
flowchart TD
    classDef allowed fill:#dcfce7,stroke:#16a34a,color:#166534,stroke-width:2px;
    classDef blocked fill:#fee2e2,stroke:#dc2626,color:#991b1b,stroke-width:2px;
    classDef check fill:#e0f2fe,stroke:#0284c7,color:#0369a1,stroke-width:2px;

    UserAction["👤 Kullanıcı Bir Görevde İşlem Yapmak İstiyor\n(Başlatma, İlerleme % Girme, Kanban Taşıma, Tamamlama)"] --> CheckAssignee{"Bu Görev Kime Atanmış?"}:::check

    CheckAssignee -- "Kullanıcının Kendisine" --> AllowExec["✅ İŞLEME İZİN VERİLİR\n- Görevi Başlatabilir\n- Not yazarak ilerleme (%40-%60) kaydedebilir\n- Kanban'da sürükleyip durumu değiştirebilir\n- Görevi tamamlayabilir"]:::allowed

    CheckAssignee -- "Başkasına Atanmış" --> BlockExec["⛔ YETKİSİZ MÜDAHALE ENGELLENDİ!\n- Başlat ve Tamamla butonları gizlenir\n- İlerleme kaydırıcısı ve hızlı butonlar kilitlenir\n- Kanban kartı sürüklenebilir değildir (draggable=false)\n- Kırmızı kilit uyarı bandı gösterilir\n- Sunucu HTTP 400 ile işlemi reddeder"]:::blocked

    CheckAssignee -- "Henüz Kimseye Atanmamış" --> ClaimTask["👤 İLK BAŞLATAN ÜZERİNE ALIR\n- Görevi başlatan veya tamamlayan kişi\n- Otomatik olarak görevin sorumlusu atanır"]:::allowed
```

---

## 👥 4. Kullanıcı Rolleri Matrisi

| Yetki & İşlem | Sistem Yöneticisi (Admin) | Proje Yöneticisi (PM) | Proje Editörü | Standart Personel (Görev Sorumlusu) |
| :--- | :---: | :---: | :---: | :---: |
| **Sistem Ayarları & SMTP Kasası** | ✅ Tam Yetkili | ❌ Göremez | ❌ Göremez | ❌ Göremez |
| **Yedek Alma & Geri Yükleme** | ✅ Tam Yetkili | ❌ Göremez | ❌ Göremez | ❌ Göremez |
| **Personel Ekleme / Dondurma** | ✅ Tam Yetkili | ❌ Göremez | ❌ Göremez | ❌ Göremez |
| **Yeni Proje Açma** | ✅ Evet | ✅ Evet (İzinli) | ❌ Hayır | ❌ Hayır |
| **Proje Plan Revizyonu** | ✅ Evet | ✅ Evet | ❌ Hayır | ❌ Hayır |
| **Görev Oluşturma / Atama** | ✅ Evet | ✅ Evet | ✅ Evet | ❌ Hayır |
| **Başkasına Atanmış Görevi Başlatma** | ⛔ Engellendi | ⛔ Engellendi | ⛔ Engellendi | ⛔ Engellendi |
| **Başkasına Atanmış Görevi Tamamlama** | ⛔ Engellendi | ⛔ Engellendi | ⛔ Engellendi | ⛔ Engellendi |
| **Kendi Görevini Başlatma/İlerletme** | ✅ Evet | ✅ Evet | ✅ Evet | ✅ Evet |
| **Kendi Bireysel To-Do'sunu Açma** | ✅ Evet | ✅ Evet | ✅ Evet | ✅ Evet |
| **Gantt & Kanban İnceleme** | ✅ Tüm Şirket | ✅ Kendi Projeleri | ✅ Kendi Projeleri | 👁️ Kendi ve Bağlı Görevleri |

---

## 🗂️ 5. Proje Dizin Yapısı ve Modül Sorumlulukları

```text
y:\gorevler1\
├── docs\                                      # Mimari infografikler ve kılavuzlar
│   ├── fg_group_sistem_mimarisi_infografik.jpg # Genel mimari infografiği
│   └── fg_group_is_akisi_ve_yetki_semasi.jpg   # Görev akışı ve yetki infografiği
├── src\
│   ├── core\                                  # Tip tanımları ve çekirdek yapılar
│   │   ├── types.ts                           # Tenant, Project, Task, User, WorkStatus
│   │   └── crypto_vault.ts                    # AES-256-GCM kurumsal şifre kasası
│   ├── database\                              # Veritabanı ve başlangıç verileri
│   │   ├── db.ts                              # PostgreSQL adaptörü & PGlite motoru
│   │   └── seed.ts                            # FG Group 5 kişilik gerçekçi demo verileri
│   ├── modules\                               # Bağımsız iş mantığı servisleri
│   │   ├── auth\                              # Giriş, profil, avatar ve hesap dondurma
│   │   ├── project\                           # Proje izolasyonu ve üyelik yetkileri
│   │   ├── task\                              # Görev oluşturma, müdahale engeli ve plan
│   │   ├── dependency\                        # DAG bağımlılık kontrolü ve döngü engeli
│   │   ├── delay\                             # Gecikme tespiti ve zorunlu gerekçe kaydı
│   │   ├── notification\                      # Mükerrerliği önleyen bildirim kuyruğu
│   │   ├── reporting\                         # Performans formülü ve özel rapor üretici
│   │   ├── microsoft_todo\                    # Microsoft Graph çift yönlü eşitleme
│   │   ├── email_automation\                  # Exchange SMTP ve Adaptive Cards
│   │   └── backup\                            # Otomatik yedekleme ve tekil proje kurtarma
│   ├── public\                                # Frontend (SPA)
│   │   ├── index.html                         # 8 modüllü arayüz iskeleti ve çekmeceler
│   │   ├── app.js                             # Durum yönetimi, Kanban, Gantt, çekmece
│   │   └── styles.css                         # Modern tema (Aydınlık/Karanlık)
│   └── server\
│       └── index.ts                           # Express REST API, CORS ve güvenlik duvarı
├── tests\
│   └── acceptance.test.ts                     # 30 adet uçtan uca kabul ve şartname testi
├── sema.md                                    # Görsel mimari rehberi
├── tam_sema.md                                # Eksiksiz mimari, yetki ve iş akışı şeması
└── takip.md                                   # Geliştirme günlüğü ve tamamlanan isterler
```

