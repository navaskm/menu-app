@echo off
title Tasty Corner - Database Setup
echo.
echo ============================================
echo   TASTY CORNER - Database Setup
echo   (Removes Restaurant & Session, Seeds DB)
echo ============================================
echo.

cd /d "c:\Users\ADMIN\OneDrive\Desktop\menu"

echo [Step 1/2] Updating database tables & seeding data...
call node seed.mjs
if %errorlevel% neq 0 (
  echo ERROR: Database setup failed!
  pause & exit /b 1
)

echo.
echo [Step 2/2] Generating Prisma client types...
cd /d "c:\Users\ADMIN\OneDrive\Desktop\menu\server"
call npx prisma generate
if %errorlevel% neq 0 (
  echo WARNING: Prisma generate had an issue, but DB is seeded.
)

echo.
echo ============================================
echo   SUCCESS! Database is updated and seeded.
echo.
echo   Owner Login:
echo     Name    : Demo Owner
echo     Email   : owner@tastycorner.demo
echo     Phone   : 9876543210
echo     Password: Owner@123
echo.
echo   Manager Login:
echo     Name    : Demo Manager One
echo     Email   : manager1@tastycorner.demo
echo     Phone   : 9876543211
echo     Password: Manager@123
echo ============================================
echo.
pause
