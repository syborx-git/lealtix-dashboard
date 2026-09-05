@echo off
REM =====================================================
REM  LEALTIX DASHBOARD - Servidor de desarrollo
REM  Arranca ng serve en http://localhost:4201
REM  Salida capturada en run_dev.log
REM =====================================================
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
echo Arrancando DASHBOARD en http://localhost:4201 ...
call npm start > run_dev.log 2>&1
