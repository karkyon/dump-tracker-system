#!/bin/bash

case "${1:-help}" in
    "start")
        echo "🐳 Docker開発環境を起動中..."
        docker compose up -d
        echo "✅ 起動完了"
        echo "🌐 Backend: http://localhost:3000"
        ;;
    "stop")
        echo "🛑 Docker開発環境を停止中..."
        docker compose down
        ;;
    "restart")
        echo "🔄 Docker開発環境を再起動中..."
        docker compose down
        docker compose up -d
        ;;
    "logs")
        docker compose logs -f "${2:-backend}"
        ;;
    "shell")
        docker compose exec backend sh
        ;;
    "clean")
        echo "🧹 Docker環境をクリーンアップ中..."
        docker compose down -v
        docker system prune -f
        ;;
    *)
        echo "🐳 Docker開発環境管理ツール"
        echo ""
        echo "使用方法: $0 [command]"
        echo ""
        echo "コマンド:"
        echo "  start    - 開発環境起動"
        echo "  stop     - 開発環境停止"
        echo "  restart  - 開発環境再起動"
        echo "  logs     - ログ表示"
        echo "  shell    - コンテナシェル"
        echo "  clean    - 環境クリーンアップ"
        ;;
esac
