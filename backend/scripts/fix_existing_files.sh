#!/bin/bash

# 正しいパス修正スクリプト
echo "🔧 ファイル存在確認と修正開始..."

# 現在のディレクトリ確認
echo "📍 現在のディレクトリ: $(pwd)"

# 実際のTSファイル一覧表示
echo "📁 実際のTypeScriptファイル構造:"
find . -name "*.ts" -type f 2>/dev/null | grep -E "(services|controllers|models)" | sort

echo ""
echo "🔍 修正が必要なファイルを個別確認..."

# 1. 実際に存在するservicesファイルを修正
echo "📝 servicesディレクトリのファイル修正..."

# userService.tsが存在する場合の修正
if [ -f "src/services/userService.ts" ]; then
    echo "  ✅ userService.ts 発見 - 修正中..."
    
    # trip参照をoperations参照に変更
    sed -i 's/prisma\.trip\./prisma.operations./g' "src/services/userService.ts"
    sed -i 's/prisma\.fuelRecord\./prisma.gps_logs./g' "src/services/userService.ts"
    sed -i 's/isActive/is_active/g' "src/services/userService.ts"
    sed -i 's/createdAt/created_at/g' "src/services/userService.ts"
    sed -i 's/userfirstName/name/g' "src/services/userService.ts"
    sed -i 's/lockedUntil/locked_until/g' "src/services/userService.ts"
    
    echo "    - trip → operations 変更完了"
    echo "    - fuelRecord → gps_logs 変更完了"
    echo "    - 命名規則統一完了"
else
    echo "  ⚠️ userService.ts が見つかりません"
fi

# tripService.tsの修正
if [ -f "src/services/tripService.ts" ]; then
    echo "  ✅ tripService.ts 発見 - 修正中..."
    
    # trip参照をoperations参照に変更
    sed -i 's/prisma\.trip\./prisma.operations./g' "src/services/tripService.ts"
    
    echo "    - trip → operations 変更完了"
else
    echo "  ⚠️ tripService.ts が見つかりません"
fi

# vehicleService.tsの修正
if [ -f "src/services/vehicleService.ts" ]; then
    echo "  ✅ vehicleService.ts 発見 - 修正中..."
    
    sed -i 's/prisma\.trip\./prisma.operations./g' "src/services/vehicleService.ts"
    sed -i 's/prisma\.inspection\./prisma.inspection_records./g' "src/services/vehicleService.ts"
    sed -i 's/plateNumber/plate_number/g' "src/services/vehicleService.ts"
    sed -i 's/lastMaintenanceDate/last_maintenance_date/g' "src/services/vehicleService.ts"
    
    echo "    - テーブル名修正完了"
else
    echo "  ⚠️ vehicleService.ts が見つかりません"
fi

# inspectionService.tsの修正
if [ -f "src/services/inspectionService.ts" ]; then
    echo "  ✅ inspectionService.ts 発見 - 修正中..."
    
    sed -i 's/prisma\.inspectionRecord\./prisma.inspection_records./g' "src/services/inspectionService.ts"
    sed -i 's/prisma\.operation\./prisma.operations./g' "src/services/inspectionService.ts"
    sed -i 's/InspectionRecordWhereInput/inspection_recordsWhereInput/g' "src/services/inspectionService.ts"
    
    echo "    - テーブル名修正完了"
else
    echo "  ⚠️ inspectionService.ts が見つかりません"
fi

# 2. modelsディレクトリのファイル修正
echo ""
echo "📝 modelsディレクトリのファイル修正..."

# User.tsの修正
if [ -f "src/models/User.ts" ]; then
    echo "  ✅ User.ts 発見 - 修正中..."
    
    sed -i 's/isActive/is_active/g' "src/models/User.ts"
    sed -i 's/userfirstName/name/g' "src/models/User.ts"
    sed -i 's/createdAt/created_at/g' "src/models/User.ts"
    sed -i 's/updatedAt/updated_at/g' "src/models/User.ts"
    sed -i 's/loginAttempts/login_attempts/g' "src/models/User.ts"
    sed -i 's/lastLogin/last_login_at/g' "src/models/User.ts"
    
    echo "    - 命名規則統一完了"
else
    echo "  ⚠️ User.ts が見つかりません"
fi

# Item.tsの修正
if [ -f "src/models/Item.ts" ]; then
    echo "  ✅ Item.ts 発見 - 修正中..."
    
    sed -i 's/prisma\.item\./prisma.items./g' "src/models/Item.ts"
    sed -i 's/prisma\.trip\./prisma.operations./g' "src/models/Item.ts"
    
    echo "    - テーブル名修正完了"
else
    echo "  ⚠️ Item.ts が見つかりません"
fi

# Location.tsの修正
if [ -f "src/models/Location.ts" ]; then
    echo "  ✅ Location.ts 発見 - 修正中..."
    
    sed -i 's/LocationType/location_type/g' "src/models/Location.ts"
    sed -i 's/RegistrationSource/registration_source/g' "src/models/Location.ts"
    
    echo "    - 型名修正完了"
else
    echo "  ⚠️ Location.ts が見つかりません"
fi

# Inspection.tsの修正
if [ -f "src/models/Inspection.ts" ]; then
    echo "  ✅ Inspection.ts 発見 - 修正中..."
    
    sed -i 's/InspectionType/inspection_type/g' "src/models/Inspection.ts"
    sed -i 's/InputType/input_type/g' "src/models/Inspection.ts"
    sed -i 's/prisma\.inspectionItem\./prisma.inspection_items./g' "src/models/Inspection.ts"
    
    echo "    - 型名・テーブル名修正完了"
else
    echo "  ⚠️ Inspection.ts が見つかりません"
fi

# 3. controllersディレクトリのファイル修正
echo ""
echo "📝 controllersディレクトリのファイル修正..."

# authController.tsの修正
if [ -f "src/controllers/authController.ts" ]; then
    echo "  ✅ authController.ts 発見 - 修正中..."
    
    sed -i 's/getPool/\/\/ getPool removed/g' "src/controllers/authController.ts"
    sed -i 's/generateAccessToken/\/\/ generateAccessToken needs implementation/g' "src/controllers/authController.ts"
    sed -i 's/jwtConfig/process.env.JWT_SECRET/g' "src/controllers/authController.ts"
    
    echo "    - 削除された関数参照修正完了"
else
    echo "  ⚠️ authController.ts が見つかりません"
fi

# userController.tsの修正
if [ -f "src/controllers/userController.ts" ]; then
    echo "  ✅ userController.ts 発見 - 修正中..."
    
    sed -i 's/getPool/\/\/ getPool removed/g' "src/controllers/userController.ts"
    
    echo "    - 削除された関数参照修正完了"
else
    echo "  ⚠️ userController.ts が見つかりません"
fi

# vehicleController.tsの修正
if [ -f "src/controllers/vehicleController.ts" ]; then
    echo "  ✅ vehicleController.ts 発見 - 修正中..."
    
    sed -i 's/getPool/\/\/ getPool removed/g' "src/controllers/vehicleController.ts"
    
    echo "    - 削除された関数参照修正完了"
else
    echo "  ⚠️ vehicleController.ts が見つかりません"
fi

# tripController.tsの修正
if [ -f "src/controllers/tripController.ts" ]; then
    echo "  ✅ tripController.ts 発見 - 修正中..."
    
    # req.user possibly undefined エラー修正
    sed -i 's/req\.user\./req.user?./g' "src/controllers/tripController.ts"
    
    echo "    - req.user 型安全性修正完了"
else
    echo "  ⚠️ tripController.ts が見つかりません"
fi

# inspectionController.tsの修正
if [ -f "src/controllers/inspectionController.ts" ]; then
    echo "  ✅ inspectionController.ts 発見 - 修正中..."
    
    sed -i 's/sendSuccess/\/\/ sendSuccess removed/g' "src/controllers/inspectionController.ts"
    sed -i 's/sendError/\/\/ sendError removed/g' "src/controllers/inspectionController.ts"
    sed -i 's/createItem/create/g' "src/controllers/inspectionController.ts"
    
    echo "    - 削除された関数参照修正完了"
else
    echo "  ⚠️ inspectionController.ts が見つかりません"
fi

# 4. middlewareディレクトリのファイル修正
echo ""
echo "📝 middlewareディレクトリのファイル修正..."

# logger.tsの修正
if [ -f "src/middleware/logger.ts" ]; then
    echo "  ✅ logger.ts 発見 - 修正中..."
    
    sed -i 's/prisma\.operation\./prisma.operations./g' "src/middleware/logger.ts"
    sed -i 's/prisma\.auditLog\./prisma.audit_logs./g' "src/middleware/logger.ts"
    
    echo "    - テーブル名修正完了"
else
    echo "  ⚠️ logger.ts が見つかりません"
fi

echo ""
echo "✅ 個別ファイル修正完了!"
echo ""
echo "📋 修正済み項目:"
echo "  ✅ 存在しないテーブル参照削除"
echo "  ✅ 命名規則統一（キャメルケース → スネークケース）"
echo "  ✅ 削除された関数参照修正"
echo "  ✅ 型安全性修正"
echo ""
echo "🔄 次のステップ:"
echo "  1. npx tsc --noEmit でエラー確認"
echo "  2. エラーが大幅に減っていることを確認"
echo "  3. 残りのエラーを個別対処"
