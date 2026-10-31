@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Amatly.com - habarlary awtomatik tazelemek
echo.
schtasks /Create /SC HOURLY /MO 2 /TN "Amatly habarlar" /TR "\"%~dp0habarlary-tazele-sessiz.bat\"" /F
if errorlevel 1 goto hata
echo.
echo TAYYAR. Kompyuter acyk we internetde bolan wagty habarlar we olaryn
echo suratlary her 2 sagatdan ozi taze alnar. Hic zat basmaly dal.
echo Isleyisin yazgysy: tools\news-update.log
echo Ayyrmak ucin: awtomat-ayyr.bat
echo.
echo Bellik: bu bukjany basga yere gocurseniz, su fayly gaytadan isledin.
goto son
:hata
echo.
echo Gurup bolmady. "Start" menyusinda cmd.exe tapyn, sag basyp
echo "Run as administrator" saylan, sol penjirede su fayly gaytadan isledin.
:son
echo.
pause
