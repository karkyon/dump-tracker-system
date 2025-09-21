import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { validateRequired, validateMinLength } from '../utils/helpers';

interface LoginFormData {
  username: string;  // emailからusernameに変更
  password: string;
  rememberMe: boolean;
}

interface FormErrors {
  username?: string;  // emailからusernameに変更
  password?: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();

  const [formData, setFormData] = useState<LoginFormData>({
    username: '',  // emailからusernameに変更
    password: '',
    rememberMe: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // ログイン済みの場合はダッシュボードにリダイレクト
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // エラーをクリア
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // ユーザー名バリデーション
    if (!validateRequired(formData.username)) {  // emailからusernameに変更
      newErrors.username = 'ユーザー名は必須です';
    }

    // パスワードバリデーション
    if (!validateRequired(formData.password)) {
      newErrors.password = 'パスワードは必須です';
    } else if (!validateMinLength(formData.password, 6)) {
      newErrors.password = 'パスワードは6文字以上で入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const success = await login({
        username: formData.username,  // emailからusernameに変更
        password: formData.password,
        rememberMe: formData.rememberMe,
      });

      if (success) {
        toast.success('ログインしました');
        const from = (location.state as any)?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      } else {
        toast.error(error || 'ログインに失敗しました');
      }
    } catch (err) {
      toast.error('ネットワークエラーが発生しました');
    }
  };

  const handleInputChange = (field: keyof LoginFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = field === 'rememberMe' ? e.target.checked : e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // エラーをクリア
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* ヘッダー */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary-600 rounded-lg flex items-center justify-center">
            <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            ダンプ運行記録アプリ
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            管理者向けCMS
          </p>
        </div>

        {/* ログインフォーム */}
        <div className="bg-white py-8 px-6 shadow-xl rounded-lg">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* エラーメッセージ */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="text-sm text-red-600">{error}</div>
              </div>
            )}

            {/* ユーザー名 */}
            <Input
              label="ユーザー名"
              type="text"
              value={formData.username}
              onChange={handleInputChange('username')}
              error={errors.username}
              placeholder="ユーザーIDを入力"
              required
              disabled={isLoading}
            />

            {/* パスワード */}
            <Input
              label="パスワード"
              type="password"
              value={formData.password}
              onChange={handleInputChange('password')}
              error={errors.password}
              placeholder="パスワードを入力"
              required
              disabled={isLoading}
            />

            {/* ログイン状態を保持 */}
            <div className="flex items-center">
              <input
                id="rememberMe"
                name="rememberMe"
                type="checkbox"
                checked={formData.rememberMe}
                onChange={handleInputChange('rememberMe')}
                disabled={isLoading}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-900">
                ログイン状態を保持する
              </label>
            </div>

            {/* ログインボタン */}
            <Button
              type="submit"
              variant="primary"
              loading={isLoading}
              disabled={isLoading}
              className="w-full"
            >
              ログイン
            </Button>
          </form>

          {/* フッター情報 */}
          <div className="mt-6 text-center text-xs text-gray-500">
            <p>初期ログイン情報については管理者にお問い合わせください</p>
          </div>
        </div>

        {/* システム情報 */}
        <div className="text-center text-xs text-gray-400">
          <p>ダンプ運行記録システム v1.0.0</p>
          <p className="mt-1">© 2025 All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;