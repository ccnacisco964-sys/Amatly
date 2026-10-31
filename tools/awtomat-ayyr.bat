@echo off
chcp 65001 >nul
schtasks /Delete /TN "Amatly habarlar" /F
if errorlevel 1 (echo Tapylmady ya-da pozup bolmady.) else (echo Awtomatik tazelenme ayryldy.)
echo.
pause
