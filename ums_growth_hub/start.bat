@echo off
title UMS Smart Growth Hub
echo ======================================================================
echo   UMS SMART GROWTH HUB - NEN TANG HO SO NANG LUC SO THCS NGOAI NGU
echo   Truong THCS Ngoai ngu - Dai hoc Ngoai ngu, DHQGHN
echo ======================================================================
echo Dang khoi dong may chu va mo trinh duyet...
python run.py
if errorlevel 1 (
    echo.
    echo [LOI] Khong the khoi dong may chu. Vui long kiem tra Python va thu vien.
    pause
)
