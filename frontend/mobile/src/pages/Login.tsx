// frontend/mobile/src/pages/Login.tsx
// D1: ログイン画面 - 修正版(未使用変数削除)

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { User, Lock, Loader, CheckCircle2, AlertCircle, Truck } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading, error, clearError } = useAuthStore();
  
  // フォーム状態
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false,
  });
  
  const [validationErrors, setValidationErrors] = useState({
    username: '',
    password: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);

  // 認証済みの場合は車両情報画面へリダイレクト
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/vehicle-info', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // エラーメッセージの表示
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // ローカルストレージから保存されたユーザーIDを復元
  useEffect(() => {
    const savedUsername = localStorage.getItem('saved_username');
    const rememberMe = localStorage.getItem('remember_me') === 'true';
    
    if (savedUsername && rememberMe) {
      setFormData(prev => ({
        ...prev,
        username: savedUsername,
        rememberMe: true,
      }));
    }
  }, []);

  // 入力変更ハンドラー
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    
    // バリデーションエラーをクリア
    if (validationErrors[name as keyof typeof validationErrors]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  // バリデーション
  const validateForm = (): boolean => {
    const errors = {
      username: '',
      password: '',
    };
    
    let isValid = true;
    
    if (!formData.username.trim()) {
      errors.username = 'ユーザーIDを入力してください';
      isValid = false;
    }
    
    if (!formData.password.trim()) {
      errors.password = 'パスワードを入力してください';
      isValid = false;
    } else if (formData.password.length < 6) {
      errors.password = 'パスワードは6文字以上である必要があります';
      isValid = false;
    }
    
    setValidationErrors(errors);
    return isValid;
  };

  // ログイン処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // バリデーション
    if (!validateForm()) {
      toast.error('入力内容を確認してください');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // ログイン実行
      await login({
        username: formData.username,
        password: formData.password,
      });
      
      // ユーザーID保存設定
      if (formData.rememberMe) {
        localStorage.setItem('saved_username', formData.username);
        localStorage.setItem('remember_me', 'true');
      } else {
        localStorage.removeItem('saved_username');
        localStorage.removeItem('remember_me');
      }
      
      toast.success('ログインに成功しました');
      
      // 車両情報画面へ遷移
      navigate('/vehicle-info', { replace: true });
      
    } catch (err: any) {
      console.error('Login error:', err);
      toast.error(err.message || 'ログインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // Enterキーでのログイン
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSubmit(e as any);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー - D4と完全統一 */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-md mx-auto px-6 py-5">
          <div className="flex items-center space-x-3">
            <Truck className="w-7 h-7" />
            <div>
              <h1 className="text-xl font-bold">運転日報アプリ</h1>
              <p className="text-blue-100 text-xs mt-0.5">ダンプトラック運行記録システム</p>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ - D4と完全統一 */}
      <main className="flex-1 px-6 py-6">
        <div className="max-w-md mx-auto">
          {/* ログインカード */}
          <div className="bg-white rounded-2xl shadow-md p-6 mb-5">
            {/* タイトルセクション */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-3">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">ログイン</h2>
              <p className="text-gray-500 text-sm">運転手アカウントでログインしてください</p>
            </div>

            {/* ログインフォーム */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ユーザーID入力 */}
              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                  ユーザーID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    onKeyPress={handleKeyPress}
                    placeholder="ユーザーIDを入力"
                    disabled={isLoading}
                    className={`w-full pl-11 pr-4 py-3 bg-gray-50 border-2 rounded-xl 
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      transition-all duration-200 text-gray-800 placeholder-gray-400
                      disabled:bg-gray-100 disabled:cursor-not-allowed
                      ${validationErrors.username 
                        ? 'border-red-300 focus:ring-red-500' 
                        : 'border-gray-200'
                      }`}
                    autoComplete="username"
                    autoFocus
                  />
                  {validationErrors.username && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </div>
                {validationErrors.username && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {validationErrors.username}
                  </p>
                )}
              </div>

              {/* パスワード入力 */}
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  パスワード
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    onKeyPress={handleKeyPress}
                    placeholder="パスワードを入力"
                    disabled={isLoading}
                    className={`w-full pl-11 pr-4 py-3 bg-gray-50 border-2 rounded-xl 
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      transition-all duration-200 text-gray-800 placeholder-gray-400
                      disabled:bg-gray-100 disabled:cursor-not-allowed
                      ${validationErrors.password 
                        ? 'border-red-300 focus:ring-red-500' 
                        : 'border-gray-200'
                      }`}
                    autoComplete="current-password"
                  />
                  {validationErrors.password && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </div>
                {validationErrors.password && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {validationErrors.password}
                  </p>
                )}
              </div>

              {/* 次回ログインIDを記録 */}
              <div className="flex items-center pt-1">
                <input
                  type="checkbox"
                  id="rememberMe"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded 
                    focus:ring-blue-500 focus:ring-2 cursor-pointer
                    disabled:cursor-not-allowed"
                />
                <label 
                  htmlFor="rememberMe" 
                  className="ml-2 text-sm text-gray-700 cursor-pointer select-none"
                >
                  次回ログインIDを記録
                </label>
              </div>

              {/* ログインボタン */}
              <button
                type="submit"
                disabled={isLoading || loading}
                className={`w-full py-3.5 rounded-xl font-semibold text-white
                  transition-all duration-200 flex items-center justify-center space-x-2
                  ${isLoading || loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl'
                  }`}
              >
                {isLoading || loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>認証中...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>ログイン</span>
                  </>
                )}
              </button>
            </form>

            {/* パスワード忘れの案内 */}
            <div className="mt-6 pt-5 border-t border-gray-200">
              <p className="text-center text-sm text-gray-600">
                パスワードをお忘れの場合は<br />
                <span className="font-semibold text-blue-600">管理者</span>にお問い合わせください
              </p>
            </div>
          </div>

          {/* バージョン情報 */}
          <div className="text-center text-sm text-gray-500">
            <p>Version 1.0.0</p>
            <p className="text-xs text-gray-400 mt-1">© 2025 ダンプ運行記録システム</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;