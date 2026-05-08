@echo off
setlocal

echo Proje baslatiliyor...

REM node_modules klasoru yoksa pnpm install calistir
if not exist "node_modules" (
    echo node_modules bulunamadi, pnpm install calistiriliyor...
    call pnpm install
    if errorlevel 1 (
        echo pnpm install basarisiz oldu!
        pause
        exit /b 1
    )
) else (
    echo node_modules zaten mevcut, pnpm install atlandi.
)

REM pnpm run dev calistir (arka planda baslatmak icin start kullanilir)
echo pnpm run dev calistiriliyor...
start cmd /c pnpm run dev

REM localhost:8080 adresini ac
echo Tarayici aciliyor...
timeout /t 2 >nul
start http://localhost:8080

echo Baslatma tamamlandi!
