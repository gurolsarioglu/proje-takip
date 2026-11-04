# 📙 FG Group Proje & Görev Yönetim Sistemi — Proje Yetkilisi (Yönetici & Editör) Kullanım Kılavuzu

**Hedef Kitle:** Proje Yöneticileri (PM), Takım Liderleri, Departman Şefleri, Proje Editörleri  
**Erişim Kapsamı:** Proje Oluşturma, Görev Tanımlama & Atama, DAG Bağımlılık Zincirleri, Gantt Takvimi, Kanban Takibi, Plan Revizyonları, Özel Raporlar

---

## 📑 İçindekiler
1. [Giriş ve Proje Yetki Rolleri](#1-giriş-ve-proje-yetki-rolleri)
2. [Yeni Proje Oluşturma ve Ekip Atama](#2-yeni-proje-oluşturma-ve-ekip-atama)
3. [Görev Tanımlama, Önceliklendirme ve Personel Atama](#3-görev-tanımlama-ve-atama)
4. [DAG Bağımlılık Yönetimi (Öncül & Ardıl Görevler)](#4-dag-bağımlılık-yönetimi)
5. [Zaman Çizelgesi (Gantt) ve Kritik Yol Takibi](#5-zaman-çizelgesi-gantt)
6. [İş Panosu (Kanban) ile Süreç İzleme](#6-iş-panosu-kanban)
7. [Plan Revizyonları ve Gecikme Takibi](#7-plan-revizyonları-ve-gecikmeler)
8. [Özel Rapor Oluşturucu ve Performans Metrikleri](#8-özel-rapor-oluşturucu)
9. [Görev Müdahale Sınırları (Önemli Güvenlik Kuralı)](#9-görev-müdahale-sınırları)

---

## 1. Giriş ve Proje Yetki Rolleri
Bir projede kullanıcılar 3 farklı yetki rolüne sahip olabilir:
1. **PROJE YÖNETİCİSİ (Project Manager):** Projeyi oluşturan veya tam yetki verilen kişidir. Proje tarihlerini, ekip üyelerini, plan revizyonlarını ve görevleri yönetebilir.
2. **PROJE EDİTÖRÜ (Editor):** Görev ekleyebilir, görevleri personellere atayabilir, bağımlılıkları tanımlayabilir.
3. **PROJE İZLEYİCİSİ (Viewer):** Projeyi ve bağımlılık akışını salt-okunur olarak inceler.

---

## 2. Yeni Proje Oluşturma ve Ekip Atama
1. Sol menüden **Projeler** modülüne gelin.
2. Sağ üstteki **"+ Yeni Proje Oluştur"** butonuna tıklayın.
3. Proje Adı, Başlangıç Tarihi, Bitiş Tarihi ve Proje Açıklamasını girin.
4. **Ekip Üyeleri Sekmesi:**
   - Projede yer alacak personelleri listeden seçin.
   - Her personele rolünü atayın (`Yönetici`, `Editör` veya `İzleyici`).
   - Eklenen her personele sistem otomatik olarak **"Projeye Dahil Edildiniz"** Outlook kartı gönderir.

---

## 3. Görev Tanımlama ve Atama
1. Proje detayında veya sağ üstteki **"+ Yeni Görev"** butonuna tıklayın.
2. **Görev Türü:**
   - 📌 **Görev (Task):** Standart iş paketi.
   - 🏁 **Kilometre Taşı (Milestone):** Kritik aşama veya onay kapısı.
   - 🐞 **Hata (Bug):** Düzeltilmesi gereken problem.
3. **Öncelik:** `Düşük`, `Normal` veya `🔥 Yüksek`.
4. **Sorumlu Personel:** İşi fiilen yürütecek personeli seçin (atanan personele anında Outlook bildirim kartı gider).
5. **Öncül Görev (Opsiyonel):** Bu görev başlamadan önce bitmesi gereken bir görev varsa açılır menüden seçin.

---

## 4. DAG Bağımlılık Yönetimi (Öncül & Ardıl Görevler)
Sistem, projelerinizin tıkanıklık yaşamaması için **Yönlü Döngüsüz Çizge (DAG)** kurallarını uygular:
- **Döngü Engeli:** `A -> B -> C` varken sistem `C -> A` bağımlılığı kurmanıza izin vermez; döngüsel kilitlenmeyi anında engeller.
- **Otomatik Kilit (BLOCKED):** Bir görevin öncülleri tamamlanmadığı sürece durumu `BLOCKED` (Öncül Bekliyor) kalır.
- **Otomatik Tetikleme (READY):** Tüm öncüller tamamlandığı anda sistem ardıl görevi saniyesinde `READY` (Başlamaya Hazır) yapar ve sorumlu personele **"🔔 Sıra Sizde!"** bildirim kartı gönderir.

---

## 5. Zaman Çizelgesi (Gantt)
- Sol menüden **Zaman Çizelgesi (Gantt)** sekmesine tıklayın.
- Projenizdeki tüm görevlerin takvim eksenindeki yerleşimini, sürelerini ve aralarındaki bağımlılık oklarını görün.
- Geciken görevler kırmızı çerçeveyle, tamamlananlar yeşil dolguyla, kritik darboğaz oluşturanlar ise **"🔥 Ardıl Görev Bekletiyor"** rozetiyle öne çıkarılır.

---

## 6. İş Panosu (Kanban)
- **Yapılacak (TODO):** Başlamaya hazır veya öncül bekleyen görevler.
- **Devam Ediyor (DOING):** Fiilen çalışılan görevler.
- **Tamamlandı (DONE):** Başarıyla bitirilmiş işler.

> [!NOTE]
> Proje Yetkilisi olarak tüm görevlerin durumunu panoda canlı izleyebilirsiniz. Ancak iş disiplini gereği, başka personele atanmış bir kartı tutup başka sütuna sürükleyemezsiniz (Aşağıdaki Madde 9'a bakınız).

---

## 7. Plan Revizyonları ve Gecikmeler
Proje gereksinimleri değiştiğinde veya müşteri termin revizyonu istediğinde:
1. İlgili görevin sağ çekmecesini (`Drawer`) açın.
2. **"Plan Revizyonu Yap"** butonuna basın.
3. Yeni başlangıç ve bitiş tarihlerini belirleyin.
4. **Zorunlu Gerekçe:** Revizyonun nedenini yazın (örn. *"Müşteri kumaş numunesinde ek renk varyantı talep etti"*).
5. Sistem ilk baz planı (`initial_due_date`) **asla silmez**; geçmiş kayıtları şeffaf bir tarihçe olarak raporda tutar.

---

## 8. Özel Rapor Oluşturucu
1. Sol menüden **Özel Raporlar** sekmesini açın.
2. Soldaki alanları (Görev Başlığı, Sorumlu, Durum, İlerleme %, Gecikme Gerekçesi vb.) sürükleyip sağdaki rapor tablosuna bırakın.
3. Excel (CSV) veya JSON formatında tek tıkla dışa aktarın.
4. Personel Performans Puanını inceleyin: Formül: `100 * (0.70 * Zamanında Teslim + 0.30 * Tamamlama Oranı)`.
   - *Not:* Personelin kontrolü dışındaki öncül gecikmelerinden dolayı oluşan beklemeler personele ceza puanı olarak yansıtılmaz (Bağımlılık Muafiyeti).

---

## 9. Görev Müdahale Sınırları (Önemli Güvenlik Kuralı)
Sistemde **hiçbir kullanıcı başkasının görevini başlatamaz, ilerletemez veya tamamlayamaz**:
- Bir görev Ali'ye atanmışsa; Ayşe (Proje Yöneticisi olsa dahi) Ali'nin adına *"ben başladım"* diyemez veya görevi *"Tamamlandı"* olarak işaretleyemez.
- Yetkili olarak siz görevin planını revize edebilir veya görevi başka personele yeniden atayabilirsiniz; ancak görevin icra sorumluluğu yalnızca atanan personele aittir.
