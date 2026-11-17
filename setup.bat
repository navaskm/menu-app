@echo off
setlocal

echo.
echo ============================================
echo   Tasty Corner - Database Setup & Seed
echo ============================================
echo.

cd /d "c:\Users\ADMIN\OneDrive\Desktop\menu"

echo [1/2] Updating database (removes Restaurant & Session, seeds data)...
call node seed.mjs
if errorlevel 1 (
  echo ERROR: Database setup failed!
  pause
  exit /b 1
)

echo.
echo [2/2] Generating Prisma client...
cd /d "c:\Users\ADMIN\OneDrive\Desktop\menu\server"
call npx prisma generate
if errorlevel 1 (
  echo WARNING: Prisma generate had an issue.
)

echo.
echo ============================================
echo   Setup complete! Database is ready.
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
