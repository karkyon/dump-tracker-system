const fs = require('fs');
const path = require('path');

/**
 * デフォルトexport重複検出スクリプト
 * C-12エラー（デフォルトexport重複）を自動検出
 */

/**
 * ディレクトリを再帰的に走査してデフォルトexportを検出
 * @param {string} dir - 検索対象ディレクトリ
 * @returns {Array} 重複が見つかったファイルのリスト
 */
function findDefaultExports(dir) {
  const results = [];

  // ディレクトリが存在しない場合
  if (!fs.existsSync(dir)) {
    console.error(`❌ エラー: ディレクトリが存在しません: ${dir}`);
    return results;
  }

  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);

    // ディレクトリの場合は再帰的に検索
    if (file.isDirectory() && file.name !== 'node_modules' && file.name !== 'dist') {
      results.push(...findDefaultExports(fullPath));
    }
    // .tsファイルの場合はチェック
    else if (file.name.endsWith('.ts') && !file.name.endsWith('.d.ts')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');

        // export defaultの出現回数をカウント
        const defaultExports = content.match(/export\s+default\s+/g) || [];

        if (defaultExports.length > 1) {
          // 行番号も取得
          const lines = content.split('\n');
          const lineNumbers = [];

          lines.forEach((line, index) => {
            if (/export\s+default\s+/.test(line)) {
              lineNumbers.push(index + 1);
            }
          });

          results.push({
            file: fullPath,
            count: defaultExports.length,
            lines: lineNumbers
          });
        }
      } catch (error) {
        console.error(`⚠️  警告: ファイル読み込みエラー: ${fullPath}`);
      }
    }
  }

  return results;
}

/**
 * メイン処理
 */
function main() {
  console.log('🔍 デフォルトexport重複をチェック中...\n');

  const srcDir = path.join(__dirname, '../src');
  const duplicates = findDefaultExports(srcDir);

  if (duplicates.length === 0) {
    console.log('✅ デフォルトexportの重複はありません\n');
    process.exit(0);
  } else {
    console.error(`❌ ${duplicates.length}個のファイルで重複が見つかりました:\n`);

    duplicates.forEach(({ file, count, lines }) => {
      const relativePath = path.relative(process.cwd(), file);
      console.error(`  📄 ${relativePath}`);
      console.error(`     重複数: ${count}個, 行: ${lines.join(', ')}\n`);
    });

    console.error('修正方法: C-11・C-12 完全撲滅マニュアル.md の Phase 2 を参照してください\n');
    process.exit(1);
  }
}

// スクリプト実行
main();
