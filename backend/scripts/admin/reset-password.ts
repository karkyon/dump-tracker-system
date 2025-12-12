// =====================================
// パスワードリセット・ユーザー作成スクリプト
// 使用方法: ts-node reset-password.ts
// =====================================

import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * パスワードハッシュ生成
 */
async function generatePasswordHash(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * 既存ユーザーのパスワードをリセット
 */
async function resetUserPassword(username: string, newPassword: string): Promise<void> {
  try {
    // パスワードハッシュ生成
    const passwordHash = await generatePasswordHash(newPassword);

    // ユーザー検索
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username }
        ]
      }
    });

    if (!user) {
      console.log(`❌ ユーザーが見つかりません: ${username}`);
      console.log('📋 既存ユーザー一覧:');
      const allUsers = await prisma.user.findMany({
        select: { id: true, username: true, email: true, role: true, isActive: true }
      });
      console.table(allUsers);
      return;
    }

    // パスワード更新
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: passwordHash,
        passwordChangedAt: new Date()
      }
    });

    console.log('✅ パスワードリセット成功！');
    console.log(`📧 ユーザー名: ${user.username}`);
    console.log(`🔐 新しいパスワード: ${newPassword}`);
    console.log(`🔑 ハッシュ値: ${passwordHash}`);

  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 新しい管理者ユーザーを作成
 */
async function createAdminUser(
  username: string,
  email: string,
  password: string,
  name: string
): Promise<void> {
  try {
    // パスワードハッシュ生成
    const passwordHash = await generatePasswordHash(password);

    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        username: username,
        email: email,
        passwordHash: passwordHash,
        name: name,
        role: UserRole.ADMIN,
        isActive: true,
        passwordChangedAt: new Date()
      }
    });

    console.log('✅ 管理者ユーザー作成成功！');
    console.log(`👤 ユーザーID: ${user.id}`);
    console.log(`📧 ユーザー名: ${user.username}`);
    console.log(`✉️  メール: ${user.email}`);
    console.log(`🔐 パスワード: ${password}`);
    console.log(`🔑 ハッシュ値: ${passwordHash}`);

  } catch (error: any) {
    if (error.code === 'P2002') {
      console.error('❌ ユーザー名またはメールアドレスが既に存在します');
    } else {
      console.error('❌ エラー:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 全ユーザー一覧表示
 */
async function listAllUsers(): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('📋 全ユーザー一覧:');
    console.table(users);

  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// =====================================
// メイン実行
// =====================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('🔧 パスワードリセット・ユーザー管理ツール\n');

  switch (command) {
    case 'reset':
      // 使用例: ts-node reset-password.ts reset admin_test newPassword123
      const username = args[1];
      const password = args[2];

      if (!username || !password) {
        console.log('❌ 使用方法: ts-node reset-password.ts reset <username> <new_password>');
        console.log('例: ts-node reset-password.ts reset admin_test admin123');
        return;
      }

      await resetUserPassword(username, password);
      break;

    case 'create':
      // 使用例: ts-node reset-password.ts create admin admin@example.com admin123 "管理者"
      const newUsername = args[1];
      const newEmail = args[2];
      const newPassword = args[3];
      const newName = args[4] || '管理者';

      if (!newUsername || !newEmail || !newPassword) {
        console.log('❌ 使用方法: ts-node reset-password.ts create <username> <email> <password> [name]');
        console.log('例: ts-node reset-password.ts create admin admin@example.com admin123 "システム管理者"');
        return;
      }

      await createAdminUser(newUsername, newEmail, newPassword, newName);
      break;

    case 'list':
      // 使用例: ts-node reset-password.ts list
      await listAllUsers();
      break;

    case 'hash':
      // 使用例: ts-node reset-password.ts hash myPassword123
      const passwordToHash = args[1];

      if (!passwordToHash) {
        console.log('❌ 使用方法: ts-node reset-password.ts hash <password>');
        console.log('例: ts-node reset-password.ts hash myPassword123');
        return;
      }

      const hash = await generatePasswordHash(passwordToHash);
      console.log('🔑 パスワードハッシュ:');
      console.log(hash);
      await prisma.$disconnect();
      break;

    default:
      console.log('📖 使用可能なコマンド:');
      console.log('');
      console.log('  list                              - 全ユーザー一覧表示');
      console.log('  reset <username> <password>       - パスワードリセット');
      console.log('  create <user> <email> <pass> [name] - 管理者ユーザー作成');
      console.log('  hash <password>                   - パスワードハッシュ生成');
      console.log('');
      console.log('例:');
      console.log('  ts-node reset-password.ts list');
      console.log('  ts-node reset-password.ts reset admin_test admin123');
      console.log('  ts-node reset-password.ts create admin admin@test.com admin123 "管理者"');
      console.log('  ts-node reset-password.ts hash myPassword123');
      break;
  }
}

main().catch(console.error);
