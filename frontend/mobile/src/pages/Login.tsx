import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Truck, Loader } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();
  
  const [formData, setFormData] = useState({
    userId: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // 既にログイン済みの場合は運行記録画面にリダイレクト
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/operation', { replace: true });
    }
    
    // 記憶されたログイン情報をチェック
    const rememberedLogin = localStorage.getItem('remember_login');
    const authToken = localStorage.getItem('auth_token');
    
    if (rememberedLogin === 'true' && authToken) {
      setRememberLogin(true);
    }
  }, [isAuthenticated, navigate]);

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.userId.trim()) {
      newErrors.userId = 'ユーザーIDを入力してください';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'パスワードを入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLoading || !validateForm()) return;

    setIsLoading(true);

    try {
      await login({ username: formData.userId, password: formData.password });
      
      if (rememberLogin) {
        localStorage.setItem('remember_login', 'true');
      } else {
        localStorage.removeItem('remember_login');
      }
      
      // 運行記録画面に遷移
      navigate('/operation', { replace: true });
    } catch (error: any) {
      console.error('ログインエラー:', error);
      setErrors({ 
        password: error.message || 'ログインに失敗しました。ユーザーIDとパスワードを確認してください。' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    clearError(field);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        {/* モバイル専用コンテナ */}
        <div 
          className="bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300"
          style={{ 
            width: '100%',
            maxWidth: '390px',
            minHeight: '600px'
          }}
        >
          {/* ヘッダー */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-12 text-center text-white relative">
            <div className="absolute inset-x-0 -bottom-6 h-12 bg-white rounded-t-[50%]"></div>
            
            <div className="relative z-10">
              <div className="w-20 h-20 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center border-3 border-white/30">
                <Truck className="w-9 h-9 text-white" />
              </div>
              <h1 className="text-2xl font-bold mb-2 tracking-wide">
                ダンプ運行記録
              </h1>
              <p className="text-sm opacity-90">運行管理システム</p>
            </div>
          </div>

          {/* フォーム */}
          <div className="px-8 py-12">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-blue-600 mb-2">ログイン</h2>
              <p className="text-gray-600 text-sm">
                ユーザーIDとパスワードを<br />入力してください
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* ユーザーID */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 pl-1">
                  ユーザーID
                </label>
                <input
                  type="text"
                  value={formData.userId}
                  onChange={(e) => handleInputChange('userId', e.target.value)}
                  className={`w-full px-5 py-4 border-2 rounded-xl text-base transition-all duration-200 ${
                    errors.userId 
                      ? 'border-red-300 bg-red-50 focus:border-red-500' 
                      : 'border-gray-200 bg-gray-50 focus:border-blue-500 focus:bg-white'
                  } focus:outline-none focus:ring-4 focus:ring-blue-100`}
                  placeholder="ユーザーIDを入力"
                  autoComplete="username"
                  disabled={isLoading}
                />
                {errors.userId && (
                  <p className="text-red-500 text-xs mt-2 pl-1">{errors.userId}</p>
                )}
              </div>

              {/* パスワード */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 pl-1">
                  パスワード
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={`w-full px-5 py-4 pr-12 border-2 rounded-xl text-base transition-all duration-200 ${
                      errors.password 
                        ? 'border-red-300 bg-red-50 focus:border-red-500' 
                        : 'border-gray-200 bg-gray-50 focus:border-blue-500 focus:bg-white'
                    } focus:outline-none focus:ring-4 focus:ring-blue-100`}
                    placeholder="パスワードを入力"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-2 pl-1">{errors.password}</p>
                )}
              </div>

              {/* ログイン状態を保持 */}
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="rememberLogin"
                  checked={rememberLogin}
                  onChange={(e) => setRememberLogin(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  disabled={isLoading}
                />
                <label 
                  htmlFor="rememberLogin" 
                  className="text-sm text-gray-700 cursor-pointer select-none"
                >
                  ログイン状態を保持する
                </label>
              </div>

              {/* ログインボタン */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-4 px-6 rounded-xl text-white font-bold text-lg transition-all duration-200 ${
                  isLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:transform active:scale-[0.98] shadow-lg hover:shadow-xl'
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>認証中...</span>
                  </div>
                ) : (
                  'ログイン'
                )}
              </button>
            </form>

            {/* フッター */}
            <div className="text-center mt-8 text-xs text-gray-500 leading-relaxed">
              パスワードをお忘れの場合は<br />
              管理者にお問い合わせください
            </div>
          </div>
        </div>

        {/* バージョン情報 */}
        <div className="text-center mt-6">
          <p className="text-white/70 text-xs">Version 1.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default Login;