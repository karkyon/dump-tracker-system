#!/bin/bash

echo "🔍 Dump Tracker Backend 環境診断"
echo "================================"

# Node.js環境
echo ""
echo "📦 Node.js環境:"
echo "  Node.js: $(node --version 2>/dev/null || echo '未インストール')"
echo "  npm: $(npm --version 2>/dev/null || echo '未インストール')"
echo "  TypeScript: $(tsc --version 2>/dev/null || echo '未インストール')"
echo "  ts-node: $(ts-node --version 2>/dev/null | head -1 || echo '未インストール')"

# Docker環境
echo ""
echo "🐳 Docker環境:"
echo "  Docker: $(docker --version 2>/dev/null || echo '未インストール')"
echo "  Docker Compose: $(docker compose version 2>/dev/null || echo '未インストール')"

# データベース環境
echo ""
echo "🗄️ データベース環境:"
echo "  PostgreSQL: $(psql --version 2>/dev/null | head -1 || echo '未インストール')"
echo "  Redis: $(redis-cli --version 2>/dev/null || echo '未インストール')"

# Webサーバー環境
echo ""
echo "🌐 Webサーバー環境:"
echo "  Nginx: $(nginx -v 2>&1 | head -1 || echo '未インストール')"

# セキュリティ環境
echo ""
echo "🔒 セキュリティ環境:"
echo "  UFW: $(sudo ufw status 2>/dev/null | head -1 || echo '確認できません')"
echo "  fail2ban: $(fail2ban-client version 2>/dev/null || echo '未インストール')"

# ポート使用状況
echo ""
echo "🔌 ポート使用状況:"
echo "  3000 (Backend): $(netstat -tlnp 2>/dev/null | grep :3000 && echo '使用中' || echo '空き')"
echo "  5432 (PostgreSQL): $(netstat -tlnp 2>/dev/null | grep :5432 && echo '使用中' || echo '空き')"
echo "  6379 (Redis): $(netstat -tlnp 2>/dev/null | grep :6379 && echo '使用中' || echo '空き')"
echo "  80 (HTTP): $(netstat -tlnp 2>/dev/null | grep :80 && echo '使用中' || echo '空き')"

# システムリソース
echo ""
echo "💻 システムリソース:"
echo "  CPU使用率: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "  メモリ使用率: $(free | grep Mem | awk '{printf("%.1f%%"), $3/$2 * 100.0}')"
echo "  ディスク使用率: $(df -h . | awk 'NR==2 {print $5}')"

echo ""
echo "✅ 環境診断完了"
