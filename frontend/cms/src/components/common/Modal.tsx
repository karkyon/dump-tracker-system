import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, closeOnEscape]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4',
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
        onClick={handleOverlayClick}
      >
        {/* Overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

        {/* Modal */}
        <div
          className={`inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:w-full ${sizeClasses[size]}`}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                {title && (
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {title}
                  </h3>
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <X className="h-6 w-6" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// 確認ダイアログコンポーネント
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '確認',
  cancelText = 'キャンセル',
  variant = 'info',
  loading = false,
}) => {
  const getVariantConfig = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          buttonVariant: 'danger' as const,
        };
      case 'warning':
        return {
          iconBg: 'bg-yellow-100',
          iconColor: 'text-yellow-600',
          buttonVariant: 'warning' as const,
        };
      default:
        return {
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          buttonVariant: 'primary' as const,
        };
    }
  };

  const config = getVariantConfig();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      closeOnOverlayClick={!loading}
      closeOnEscape={!loading}
    >
      <div className="sm:flex sm:items-start">
        <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${config.iconBg} sm:mx-0 sm:h-10 sm:w-10`}>
          <X className={`h-6 w-6 ${config.iconColor}`} />
        </div>
        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
          {title && (
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-2">
              {title}
            </h3>
          )}
          <div className="mt-2">
            <p className="text-sm text-gray-500">{message}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
        <Button
          variant={config.buttonVariant}
          onClick={onConfirm}
          loading={loading}
          disabled={loading}
          className="w-full sm:w-auto sm:ml-3"
        >
          {confirmText}
        </Button>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={loading}
          className="mt-3 w-full sm:mt-0 sm:w-auto"
        >
          {cancelText}
        </Button>
      </div>
    </Modal>
  );
};

// フォームモーダル用のレイアウトコンポーネント
interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSubmit?: () => void;
  submitText?: string;
  cancelText?: string;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  submitText = '保存',
  cancelText = 'キャンセル',
  loading = false,
  size = 'md',
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      closeOnOverlayClick={!loading}
      closeOnEscape={!loading}
    >
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}>
        <div className="space-y-4">
          {children}
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </Button>
          {onSubmit && (
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading}
            >
              {submitText}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default Modal;