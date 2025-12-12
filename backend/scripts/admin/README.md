# 管理者ツール

## パスワードリセット

### 全ユーザー一覧
```bash
npm run admin:list-users
```

### パスワードリセット
```bash
npm run admin:reset-password <username> <new_password>
```

例:
```bash
npm run admin:reset-password admin_test admin123
```

## 注意事項
- 本番環境では慎重に使用すること
- パスワードは強固なものを設定すること
