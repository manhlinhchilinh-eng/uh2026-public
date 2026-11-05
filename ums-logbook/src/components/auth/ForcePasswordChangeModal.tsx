import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { ShieldAlert, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface ForcePasswordChangeModalProps {
  isOpen: boolean;
  onSuccess?: () => void;
  isMandatory?: boolean;
  onClose?: () => void;
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({
  isOpen,
  onSuccess,
  isMandatory = true,
  onClose,
}) => {
  const { changePassword, isLoading, error, clearError } = useAuth();
  const { t } = useLanguage();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Validation criteria
  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  // Mật khẩu mới phải khác mật khẩu được cấp (đang nhập ở ô trên)
  const isNotDefault = newPassword.length > 0 && newPassword !== currentPassword;
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

  const isFormValid =
    hasMinLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumber &&
    isNotDefault &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!isNotDefault) {
      setValidationError('Mật khẩu mới phải khác mật khẩu được cấp.');
      return;
    }
    if (!hasMinLength) {
      setValidationError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      setValidationError('Mật khẩu phải chứa ít nhất một chữ hoa, chữ thường và chữ số.');
      return;
    }
    if (!passwordsMatch) {
      setValidationError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    try {
      await changePassword(newPassword, currentPassword);
      if (onSuccess) onSuccess();
      if (!isMandatory && onClose) onClose();
    } catch (err: any) {
      // Error handled by AuthContext
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#8B1A4A] p-5 text-white flex items-center space-x-3">
          <div className="p-2 bg-white/10 rounded-xl">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold leading-tight">{t.auth.changePasswordTitle}</h3>
            <p className="text-xs text-white/80 mt-0.5">{t.auth.changePasswordDesc}</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {(error || validationError) && (
            <div
              className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{validationError || error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label
                htmlFor="current-password-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {t.auth.currentPassword} (mật khẩu được cấp)
              </label>
              <div className="relative">
                <input
                  id="current-password-input"
                  name="currentPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (clearError) clearError();
                  }}
                  required
                  className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#8B1A4A] focus:border-[#8B1A4A]"
                />
              </div>
            </div>

            {/* New Password */}
            <div>
              <label
                htmlFor="new-password-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {t.auth.newPassword}
              </label>
              <div className="relative">
                <input
                  id="new-password-input"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setValidationError(null);
                    if (clearError) clearError();
                  }}
                  required
                  placeholder="Nhập mật khẩu mới..."
                  className="block w-full px-3 py-2 pr-10 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#8B1A4A] focus:border-[#8B1A4A]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label
                htmlFor="confirm-password-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {t.auth.confirmPassword}
              </label>
              <input
                id="confirm-password-input"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setValidationError(null);
                }}
                required
                placeholder="Nhập lại mật khẩu mới..."
                className="block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#8B1A4A] focus:border-[#8B1A4A]"
              />
            </div>

            {/* Password Criteria Checklist */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <p className="font-semibold text-slate-600 mb-1">Quy định bảo mật mật khẩu:</p>
              <div className="flex items-center space-x-2">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${hasMinLength ? 'text-emerald-600' : 'text-slate-300'}`}
                />
                <span className={hasMinLength ? 'text-slate-800' : 'text-slate-400'}>
                  Tối thiểu 8 ký tự
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${hasUpperCase ? 'text-emerald-600' : 'text-slate-300'}`}
                />
                <span className={hasUpperCase ? 'text-slate-800' : 'text-slate-400'}>
                  Có ít nhất một chữ in hoa (A-Z)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${hasLowerCase ? 'text-emerald-600' : 'text-slate-300'}`}
                />
                <span className={hasLowerCase ? 'text-slate-800' : 'text-slate-400'}>
                  Có ít nhất một chữ thường (a-z)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${hasNumber ? 'text-emerald-600' : 'text-slate-300'}`}
                />
                <span className={hasNumber ? 'text-slate-800' : 'text-slate-400'}>
                  Có ít nhất một chữ số (0-9)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${isNotDefault ? 'text-emerald-600' : 'text-slate-300'}`}
                />
                <span className={isNotDefault ? 'text-slate-800' : 'text-slate-400'}>
                  Khác mật khẩu được cấp
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${passwordsMatch ? 'text-emerald-600' : 'text-slate-300'}`}
                />
                <span className={passwordsMatch ? 'text-slate-800' : 'text-slate-400'}>
                  Hai mật khẩu mới trùng khớp
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center space-x-3">
              {!isMandatory && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  {t.common.cancel}
                </button>
              )}
              <button
                type="submit"
                disabled={!isFormValid || isLoading}
                className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-[#8B1A4A] hover:bg-[#74173F] rounded-xl shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? t.common.loading : t.auth.updatePasswordBtn}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
