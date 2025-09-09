#!/bin/bash
# API テストスクリプト

API_BASE="http://localhost:8000/api/v1"
TOKEN=""

# 色付きログ
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# ヘルスチェック
test_health() {
    log_info "ヘルスチェックテスト中..."
    response=$(curl -s "$API_BASE/../health")
    if echo "$response" | grep -q '"status":"OK"'; then
        log_success "ヘルスチェック成功"
        return 0
    else
        log_error "ヘルスチェック失敗: $response"
        return 1
    fi
}

# ログインテスト
test_login() {
    log_info "ログインテスト中..."
    response=$(curl -s -X POST "$API_BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"admin123"}')
    
    if echo "$response" | grep -q '"success":true'; then
        TOKEN=$(echo "$response" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
        log_success "ログイン成功"
        return 0
    else
        log_error "ログイン失敗: $response"
        return 1
    fi
}

# ユーザー情報取得テスト
test_get_user() {
    log_info "ユーザー情報取得テスト中..."
    response=$(curl -s -X GET "$API_BASE/auth/me" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "ユーザー情報取得成功"
        return 0
    else
        log_error "ユーザー情報取得失敗: $response"
        return 1
    fi
}

# 車両一覧取得テスト
test_get_vehicles() {
    log_info "車両一覧取得テスト中..."
    response=$(curl -s -X GET "$API_BASE/vehicles" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$response    res.json({
      success: true,
      message: 'トークンが更新されました',
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'トークンの更新に失敗しました',
      error: 'TOKEN_REFRESH_ERROR'
    });
  }
};


# 車両作成テスト
test_create_vehicle() {
    log_info "車両作成テスト中..."
    response=$(curl -s -X POST "$API_BASE/vehicles" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "plateNumber": "テスト 999 て 9999",
            "model": "テスト車両",
            "manufacturer": "テストメーカー",
            "year": 2023,
            "fuelType": "DIESEL",
            "capacityTons": 5.0,
            "currentMileage": 0
        }')
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "車両作成成功"
        return 0
    else
        log_error "車両作成失敗: $response"
        return 1
    fi
}

# メインテスト実行
main() {
    echo "🧪 API テスト開始"
    echo ""
    
    test_health || exit 1
    test_login || exit 1
    test_get_user || exit 1
    test_get_vehicles || exit 1
    test_create_vehicle || exit 1
    
    echo ""
    log_success "🎉 全てのテストが成功しました"
}

main "$@"
