@echo off
title Lealtix DASHBOARD - http://localhost:4201
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
echo =====================================================
echo  LEALTIX DASHBOARD - http://localhost:4201
echo  Compilando componentes Angular / Vite...
echo  (La primera compilacion puede tardar aprox 2 minutos)
echo =====================================================
echo.
call npm start
