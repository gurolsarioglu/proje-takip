@echo off
chcp 65001 >nul
title FG Group - Görev ve Proje Yönetim Sistemi
cd /d "%~dp0"

echo ================================================================
echo           FG GROUP - GÖREV VE PROJE YÖNETİM SİSTEMİ
echo ================================================================
echo.
echo [1/3] Sistem gereksinimleri kontrol ediliyor...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Node.js sistemde bulunamadı!
    echo Lütfen https://nodejs.org adresinden Node.js kurun.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [BİLGİ] İlk kurulum: Bağımlılık paketleri yükleniyor, lütfen bekleyin...
    call npm install
    if %errorlevel% neq 0 (
        echo [HATA] Paket yükleme başarısız oldu!
        pause
        exit /b 1
    )
)

echo [2/3] Tarayıcı 3 saniye içinde otomatik açılacak...
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

echo [3/3] Sunucu başlatılıyor (0.0.0.0:3000)...
echo.
echo ================================================================
echo   Yerel Erişim (Bu Bilgisayar) : http://localhost:3000
echo   Ağ Erişimi (Mobil / Tablet)  : http://10.1.0.40:3000
echo ----------------------------------------------------------------
echo   Durdurmak için: Bu pencereyi kapatabilir veya Ctrl+C yapabilirsiniz.
echo ================================================================
echo.

call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [UYARI] Sunucu bir hata nedeniyle sonlandı.
    pause
)
