@echo off
setlocal

set "PROJECT_DIR=C:\Users\Christoph\trackline"
set "SERVER_DIR=C:\Users\Christoph\trackline\server"
set "FRONTEND_URL=http://127.0.0.1:5173/"
set "SERVER_HEALTH_URL=http://127.0.0.1:3001/health"

title Trackline Starter

echo.
echo ========================================
echo  Trackline lokal starten
echo ========================================
echo.

if not exist "%PROJECT_DIR%" (
  echo FEHLER: Projektordner nicht gefunden:
  echo %PROJECT_DIR%
  pause
  exit /b 1
)

if not exist "%SERVER_DIR%" (
  echo FEHLER: Serverordner nicht gefunden:
  echo %SERVER_DIR%
  pause
  exit /b 1
)

if not exist "%PROJECT_DIR%\package.json" (
  echo FEHLER: package.json im Projektordner nicht gefunden:
  echo %PROJECT_DIR%\package.json
  pause
  exit /b 1
)

set "SERVER_ENTRY=index.js"

if exist "%SERVER_DIR%\index.js" (
  set "SERVER_ENTRY=index.js"
) else (
  if exist "%SERVER_DIR%\index.js.js" (
    set "SERVER_ENTRY=index.js.js"
  ) else (
    echo FEHLER: Keine Server-Startdatei gefunden.
    echo Gesucht wurde:
    echo %SERVER_DIR%\index.js
    echo %SERVER_DIR%\index.js.js
    pause
    exit /b 1
  )
)

echo Starte lokalen Socket/Spotify-Server auf Port 3001...
echo Serverordner: %SERVER_DIR%
echo Serverdatei: %SERVER_ENTRY%
start "Trackline Server 3001" cmd /k "cd /d "%SERVER_DIR%" && node "%SERVER_ENTRY%""

echo.
echo Warte kurz, bevor Vite startet...
timeout /t 2 /nobreak >nul

echo Starte Vite Frontend auf Port 5173...
echo Projektordner: %PROJECT_DIR%
start "Trackline Vite 5173" cmd /k "cd /d "%PROJECT_DIR%" && npm run dev -- --host 0.0.0.0 --port 5173"

echo.
echo Warte kurz, dann Browser oeffnen...
timeout /t 3 /nobreak >nul

start "" "%FRONTEND_URL%"

echo.
echo ========================================
echo  Gestartet
echo ========================================
echo.
echo Frontend:
echo %FRONTEND_URL%
echo.
echo Lokaler Server Health:
echo %SERVER_HEALTH_URL%
echo.
echo Wichtig:
echo - Dieses Fenster kannst du schliessen.
echo - Die zwei neuen CMD-Fenster offen lassen.
echo - Zum Stoppen in beiden Fenstern Ctrl+C druecken.
echo.
echo Render musst du separat im Browser starten/deployen.
echo.

pause
