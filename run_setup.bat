@echo off
cd /d "c:\Users\ADMIN\OneDrive\Desktop\menu\server"
echo === Running Prisma Generate ===
call npx prisma generate
echo === Running DB Migration ===
call npx prisma migrate deploy
echo === Seeding Database ===
call npm run db:seed
echo === Done ===
pause

