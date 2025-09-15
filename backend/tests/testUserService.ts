import { userService } from "../src/services/userService";

async function main() {
  try {
    // 全ユーザー取得テスト
    const users = await userService.getAllUsers({ page: 1, limit: 5 });
    console.log("Users:", users);

    // 新規ユーザー作成テスト
    const newUser = await userService.createUser({
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      name: "テストユーザー",
      role: "DRIVER",
    });
    console.log("Created:", newUser);

    // ユーザー取得
    const user = await userService.getUserById(newUser.id);
    console.log("Fetched:", user);

  } catch (err) {
    console.error("Error:", err);
  }
}

main();
