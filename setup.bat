@echo off
setlocal

echo.
echo ============================================
echo   Tasty Corner - Backend Setup
echo ============================================
echo.

cd /d "c:\Users\ADMIN\OneDrive\Desktop\menu\server"
if errorlevel 1 (
  echo ERROR: Could not navigate to server directory
  pause
  exit /b 1
)

echo [1/4] Installing server dependencies...
call npm install
if errorlevel 1 (
  echo ERROR: npm install failed
  pause
  exit /b 1
)

echo.
echo [2/4] Generating Prisma client...
call npx prisma generate
if errorlevel 1 (
  echo ERROR: prisma generate failed
  pause
  exit /b 1
)

echo.
echo [3/4] Running database migrations...
call npx prisma migrate dev --name init
if errorlevel 1 (
  echo WARNING: migrate dev failed, trying deploy...
  call npx prisma migrate deploy
)

echo.
echo [4/4] Seeding database with demo data...
call npm run db:seed
if errorlevel 1 (
  echo ERROR: seed failed
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Setup complete! Database seeded.
echo   Now start the servers:
echo     Server: cd server ^&^& npm run dev
echo     Client: cd client ^&^& npm run dev
echo ============================================
echo.
pause

