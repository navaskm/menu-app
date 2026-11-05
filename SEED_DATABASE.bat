@echo off
title Tasty Corner - Database Setup
echo.
echo ============================================
echo   TASTY CORNER - Database Setup (Prisma v7)
echo ============================================
echo.

cd /d "c:\Users\ADMIN\OneDrive\Desktop\menu\server"
echo Working dir: %CD%
echo.

echo [Step 1/3] Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (
  echo ERROR: prisma generate failed!
  pause & exit /b 1
)
echo OK!

echo.
echo [Step 2/3] Pushing schema to database (creates tables)...
call npx prisma db push
if %errorlevel% neq 0 (
  echo ERROR: db push failed! Check DATABASE_URL in server\.env
  pause & exit /b 1
)
echo OK!

echo.
echo [Step 3/3] Seeding demo data...
call npx tsx prisma/seed.ts
if %errorlevel% neq 0 (
  echo ERROR: Seed failed!
  pause & exit /b 1
)

echo.
echo ============================================
echo   SUCCESS! Open two terminals and run:
echo     Terminal 1:  cd server  then  npm run dev
echo     Terminal 2:  cd client  then  npm run dev
echo   Then open http://localhost:3000
echo ============================================
echo.
pause
