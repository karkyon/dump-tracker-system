# dump-tracker-system - Package.json解析

**生成日時:** Tue Sep  9 09:43:53 AM UTC 2025

## 📦 ./package.json

**名前:** dump-tracker-system
**バージョン:** 1.0.0
**説明:** ダンプ運行記録日報システム - Dump Truck Operation Daily Report System

**Dependencies数:** 0
**DevDependencies数:** 14

### Scripts一覧
  "scripts": {
- `dev`: concurrently \
- `dev:frontend`: cd frontend && npm run dev
- `dev:backend`: cd backend && npm run dev
- `build`: npm run build:frontend && npm run build:backend
- `build:frontend`: cd frontend && npm run build
- `build:backend`: cd backend && npm run build
- `test`: npm run test:frontend && npm run test:backend
- `test:frontend`: cd frontend && npm run test
- `test:backend`: cd backend && npm run test
- `lint`: npm run lint:frontend && npm run lint:backend
- `lint:frontend`: cd frontend && npm run lint
- `lint:backend`: cd backend && npm run lint
- `docker:up`: cd backend && docker-compose up -d
- `docker:down`: cd backend && docker-compose down
- `docker:build`: cd backend && docker-compose build
- `db:migrate`: cd backend && npx prisma migrate dev
- `db:seed`: cd backend && npx prisma db seed
- `db:reset`: cd backend && npx prisma migrate reset --force
- `setup`: npm install && cd frontend && npm install && cd ../backend && npm install
- `clean`: rm -rf node_modules frontend/node_modules backend/node_modules
- `start`: npm run docker:up && npm run dev
  "workspaces": [
  "devDependencies": {
- `concurrently`: ^8.2.2
  "engines": {
- `node`: >=20.0.0
- `npm`: >=8.0.0
  "repository": {
- `type`: git
- `url`: https://github.com/YOUR_USERNAME/dump-tracker-system.git
  "keywords": [
- `author`: Your Name <your.email@example.com>
- `license`: MIT
  "bugs": {
- `url`: https://github.com/YOUR_USERNAME/dump-tracker-system/issues
- `homepage`: https://github.com/YOUR_USERNAME/dump-tracker-system#readme

---
## 📦 ./frontend/package.json

**名前:** dump-tracker-frontend
**バージョン:** 1.0.0
**説明:** ダンプトラック運行記録・GPS追跡・日報管理システム フロントエンド

**Dependencies数:** 34
**DevDependencies数:** 22

### Scripts一覧
  "scripts": {
- `dev`: vite --port 3001
- `build`: tsc && vite build
- `preview`: vite preview --port 3001
- `lint`: eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
- `lint:fix`: eslint . --ext ts,tsx --fix
- `type-check`: tsc --noEmit
  "dependencies": {
- `@tanstack/react-query`: ^5.85.3
- `axios`: ^1.11.0
- `bcryptjs`: ^3.0.2
- `date-fns`: ^4.1.0
- `jsonwebtoken`: ^9.0.2
- `lucide-react`: ^0.263.1
- `react`: ^18.2.0
- `react-dom`: ^18.2.0
- `react-hot-toast`: ^2.4.0
- `react-router-dom`: ^6.30.1
- `zustand`: ^4.5.7
  "devDependencies": {
- `@types/bcryptjs`: ^2.4.6
- `@types/jsonwebtoken`: ^9.0.10
- `@types/react`: ^18.0.28
- `@types/react-dom`: ^18.0.11
- `@typescript-eslint/eslint-plugin`: ^5.57.1
- `@typescript-eslint/parser`: ^5.57.1
- `@vitejs/plugin-react`: ^4.7.0
- `autoprefixer`: ^10.4.14
- `eslint`: ^8.38.0
- `eslint-plugin-jsx-a11y`: ^6.7.1
- `eslint-plugin-react`: ^7.32.2
- `eslint-plugin-react-hooks`: ^4.6.0
- `eslint-plugin-react-refresh`: ^0.3.4
- `postcss`: ^8.4.23
- `tailwindcss`: ^3.3.0
- `typescript`: ^5.0.2
- `vite`: ^4.3.2
  "engines": {
- `node`: >=16.0.0
- `npm`: >=7.0.0
  "keywords": [

---
## 📦 ./backend/package.json

**名前:** dump-tracker-backend
**バージョン:** 1.0.0
**説明:** ダンプ運行記録システム - バックエンドAPI

**Dependencies数:** 57
**DevDependencies数:** 30

### Scripts一覧
  "scripts": {
- `dev`: nodemon --exec ts-node src/server.ts
- `build`: tsc
- `start`: node dist/server.js
- `test`: jest
- `test:watch`: jest --watch
- `test:coverage`: jest --coverage
- `lint`: eslint src/**/*.ts
- `lint:fix`: eslint src/**/*.ts --fix
- `db:setup`: npm run db:create && npm run db:migrate && npm run db:seed
- `db:create`: createdb dump_tracker || true
- `db:migrate`: node -e \
- `db:seed`: node -e \
- `db:reset`: npm run db:drop && npm run db:setup
- `db:drop`: dropdb dump_tracker || true
- `db:ping`: pg_isready -h localhost -p 5432
- `gdrive:upload`: ./scripts/development/upload_templates_to_gdrive.sh
- `gdrive:download`: ./scripts/development/download_from_gdrive.sh
- `gdrive:sync`: ./scripts/development/sync_with_gdrive.sh
- `build:watch`: tsc --watch
- `clean`: rm -rf dist
- `prebuild`: npm run clean
- `api:start`: npm run build && npm start
- `api:dev`: npm run dev
- `type-check`: tsc --noEmit
- `test:build`: npm run clean && npm run build
  "dependencies": {
- `@prisma/client`: ^6.14.0
- `@types/bcrypt`: ^6.0.0
- `@types/swagger-jsdoc`: ^6.0.4
- `bcrypt`: ^6.0.0
- `bcryptjs`: ^2.4.3
- `compression`: ^1.7.4
- `cors`: ^2.8.5
- `dotenv`: ^16.3.1
- `express`: ^4.18.2
- `express-rate-limit`: ^6.11.2
- `express-validator`: ^7.0.1
- `helmet`: ^7.0.0
- `joi`: ^17.9.2
- `jsonwebtoken`: ^9.0.2
- `moment`: ^2.29.4
- `moment-timezone`: ^0.5.43
- `morgan`: ^1.10.0
- `multer`: ^1.4.5-lts.1
- `nodemailer`: ^6.9.4
- `pg`: ^8.11.3
- `prisma`: ^6.14.0
- `swagger-jsdoc`: ^6.2.8
- `swagger-ui-express`: ^5.0.1
- `uuid`: ^9.0.0
- `winston`: ^3.10.0
- `yamljs`: ^0.3.0
  "devDependencies": {
- `@types/bcryptjs`: ^2.4.2
- `@types/compression`: ^1.7.2
- `@types/cors`: ^2.8.13
- `@types/express`: ^4.17.17
- `@types/express-validator`: ^2.20.33
- `@types/jest`: ^29.5.3
- `@types/jsonwebtoken`: ^9.0.2
- `@types/morgan`: ^1.9.4
- `@types/multer`: ^1.4.7
- `@types/node`: ^20.4.7
- `@types/nodemailer`: ^6.4.9
- `@types/pg`: ^8.10.2
- `@types/supertest`: ^2.0.12
- `@types/swagger-ui-express`: ^4.1.8
- `@types/uuid`: ^9.0.2
- `@typescript-eslint/eslint-plugin`: ^6.2.1
- `@typescript-eslint/parser`: ^6.2.1
- `eslint`: ^8.45.0
- `jest`: ^29.6.2
- `nodemon`: ^3.1.10
- `prettier`: ^3.0.0
- `supertest`: ^6.3.3
- `ts-jest`: ^29.1.1
- `ts-node`: ^10.9.1
- `ts-node-dev`: ^2.0.0
- `typescript`: ^5.1.6
  "engines": {
- `node`: >=14.0.0
- `npm`: >=6.0.0

---
