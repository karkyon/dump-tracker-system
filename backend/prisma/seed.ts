import { PrismaClient, UserRole, VehicleStatus, FuelType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 データベースシードを開始します...');

  // パスワードハッシュ化
  const adminPassword = await bcrypt.hash('admin123!', 10);
  const managerPassword = await bcrypt.hash('manager123!', 10);
  const driverPassword = await bcrypt.hash('driver123!', 10);

  // 管理者ユーザー作成
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dumptracker.com' },
    update: {},
    create: {
      email: 'admin@dumptracker.com',
      username: 'admin',
      password: adminPassword,
      firstName: '管理者',
      lastName: 'システム',
      role: UserRole.ADMIN,
    },
  });

  // マネージャーユーザー作成
  const manager = await prisma.user.upsert({
    where: { email: 'manager@dumptracker.com' },
    update: {},
    create: {
      email: 'manager@dumptracker.com',
      username: 'manager',
      password: managerPassword,
      firstName: '田中',
      lastName: '太郎',
      role: UserRole.MANAGER,
    },
  });

  // 運転手ユーザー作成
  const driver = await prisma.user.upsert({
    where: { email: 'driver@dumptracker.com' },
    update: {},
    create: {
      email: 'driver@dumptracker.com',
      username: 'driver01',
      password: driverPassword,
      firstName: '佐藤',
      lastName: '次郎',
      role: UserRole.DRIVER,
      driverProfile: {
        create: {
          licenseNumber: 'DL123456789',
          licenseExpiryDate: new Date('2026-12-31'),
          phoneNumber: '090-1234-5678',
          emergencyContact: '090-8765-4321',
          address: '東京都新宿区1-1-1',
          birthDate: new Date('1985-05-15'),
          hireDate: new Date('2022-04-01'),
        },
      },
    },
  });

  console.log('✅ シードデータの作成が完了しました');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
