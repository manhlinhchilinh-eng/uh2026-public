/**
 * UMS Digital Class Logbook - Create Behavior Note Modal
 * Milestone 3: Accessible dual-mode modal (in-period logbook vs standalone mode)
 * Path: src/components/behavior/CreateBehaviorNoteModal.tsx
 */

import React, { useState, useEffect } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { StudentDoc, BehaviorNote, BehaviorType, UserRole } from '../../types';
import {
  POSITIVE_BEHAVIOR_CATEGORIES,
  NEGATIVE_BEHAVIOR_CATEGORIES,
} from '../../types/behavior';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { fetchClassRoster } from '../../services/rosterService';
import { ALL_CLASSES } from '../../services/logbookService';
import { createBehaviorNote } from '../../services/behaviorService';
import {
  X,
  Award,
  ThumbsUp,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

export const POSITIVE_CATEGORIES = POSITIVE_BEHAVIOR_CATEGORIES.map((c) => c.labelVi).concat(['Khác']);
export const NEGATIVE_CATEGORIES = NEGATIVE_BEHAVIOR_CATEGORIES.map((c) => c.labelVi).concat(['Khác']);

export interface CreateBehaviorNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId?: string;
  studentId?: string;
  studentName?: string;
  periodIndex?: number;
  subject?: string;
  roster?: StudentDoc[];
  onSaved?: (note: BehaviorNote) => void;
}

export const CreateBehaviorNoteModal: React.FC<CreateBehaviorNoteModalProps> = ({
  isOpen,
  onClose,
  classId: initialClassId,
  studentId: initialStudentId,
  studentName: initialStudentName,
  periodIndex,
  subject,
  roster: initialRoster,
  onSaved,
}) => {
  const { profile, activeRole } = useAuth();
  const { t } = useLanguage();

  const [selectedClass, setSelectedClass] = useState<string>(
    initialClassId || profile?.assignedClassId || '6A1'
  );
  const [roster, setRoster] = useState<StudentDoc[]>(initialRoster || []);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');
  const [noteType, setNoteType] = useState<BehaviorType>('positive');
  const [category, setCategory] = useState<string>(POSITIVE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [keepOpen, setKeepOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync classId when opened or changed
  useEscapeKey(isOpen, onClose);

  useEffect(() => {
    if (initialClassId) {
      setSelectedClass(initialClassId);
    } else if (profile?.assignedClassId) {
      setSelectedClass(profile.assignedClassId);
    }
  }, [initialClassId, profile?.assignedClassId, isOpen]);

  // Sync roster on class change
  useEffect(() => {
    if (!isOpen) return;
    if (initialRoster && initialRoster.length > 0 && initialClassId === selectedClass) {
      setRoster(initialRoster);
      return;
    }
    let alive = true;
    fetchClassRoster(selectedClass).then((r) => alive && setRoster(r));
    return () => {
      alive = false;
    };
  }, [selectedClass, isOpen, initialClassId, initialRoster]);

  // Reset category on type switch
  useEffect(() => {
    if (noteType === 'positive') {
      setCategory(POSITIVE_CATEGORIES[0]);
    } else {
      setCategory(NEGATIVE_CATEGORIES[0]);
    }
  }, [noteType]);

  // Set initial student if provided
  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
    }
  }, [initialStudentId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedStudentId) {
      setErrorMessage('Vui lòng chọn học sinh');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Vui lòng nhập nội dung nhận xét chi tiết');
      return;
    }

    const finalCategory = category === 'Khác' && customCategory.trim() ? customCategory.trim() : category;
    const targetStudent = roster.find((s) => s.id === selectedStudentId || s.mhs === selectedStudentId);

    const sName = targetStudent ? targetStudent.name : initialStudentName || 'Học sinh';
    const sNumber = targetStudent ? targetStudent.stt : undefined;
    const sCode = targetStudent ? targetStudent.mhs || targetStudent.id : selectedStudentId;

    const notePayload = {
      studentId: selectedStudentId,
      studentName: sName,
      studentNumber: sNumber,
      studentCode: sCode,
      classId: selectedClass,
      type: noteType,
      category: finalCategory,
      content: description.trim(),
      description: description.trim(),
      authorId: profile?.uid || profile?.username || 'unknown',
      authorName: profile?.displayName || profile?.username || 'Giáo viên',
      authorRole: (activeRole as UserRole) || 'gvbm',
      periodIndex,
      subject,
      date: new Date().toISOString().split('T')[0],
      context: periodIndex ? ('period' as const) : ('general' as const),
      timestamp: Date.now(),
    };

    setSaving(true);
    try {
      const saved = await createBehaviorNote(notePayload as any, profile || undefined);
      if (onSaved) onSaved(saved);

      if (keepOpen) {
        setSelectedStudentId('');
        setDescription('');
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi lưu phiếu ghi nhận');
    } finally {
      setSaving(false);
    }
  };

  const isPeriodMode = periodIndex !== undefined;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="bg-[#8B1A4A] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-pink-200" />
            <div>
              <h2 className="text-base font-bold">
                {isPeriodMode ? `Ghi nhận nề nếp tiết ${periodIndex}` : t.behavior.newNote}
              </h2>
              {isPeriodMode && subject && (
                <p className="text-xs text-pink-200">
                  Lớp {selectedClass} • Môn: {subject}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Class Picker (if standalone and has campus-wide role) */}
          {!isPeriodMode && (activeRole === 'admin' || activeRole === 'tpt' || activeRole === 'giamthi') && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Lớp</label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedStudentId('');
                }}
                className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-[#8B1A4A]"
              >
                {ALL_CLASSES.map((cls: string) => (
                  <option key={cls} value={cls}>
                    Lớp {cls}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Student Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Học sinh <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              required
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#8B1A4A]"
            >
              <option value="">-- Chọn học sinh từ danh sách --</option>
              {roster.map((s) => (
                <option key={s.id || s.mhs} value={s.id || s.mhs}>
                  STT {s.stt}: {s.name} ({s.mhs})
                </option>
              ))}
            </select>
          </div>

          {/* Type Selector (Positive vs Negative) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Loại ghi nhận</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNoteType('positive')}
                className={`flex items-center justify-center space-x-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  noteType === 'positive'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-200'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ThumbsUp className={`w-4 h-4 ${noteType === 'positive' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{t.behavior.positive}</span>
              </button>

              <button
                type="button"
                onClick={() => setNoteType('negative')}
                className={`flex items-center justify-center space-x-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  noteType === 'negative'
                    ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-200'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className={`w-4 h-4 ${noteType === 'negative' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>{t.behavior.negative}</span>
              </button>
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Hạng mục</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#8B1A4A]"
            >
              {(noteType === 'positive' ? POSITIVE_CATEGORIES : NEGATIVE_CATEGORIES).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {category === 'Khác' && (
              <input
                type="text"
                placeholder="Nhập tên hạng mục khác..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="mt-2 w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-[#8B1A4A]"
              />
            )}
          </div>

          {/* Detailed Observation Content */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Chi tiết nhận xét / quan sát <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                noteType === 'positive'
                  ? 'Ví dụ: Tích cực phát biểu xây dựng bài, đưa ra cách giải sáng tạo...'
                  : 'Ví dụ: Không chuẩn bị bài tập về nhà, mất trật tự nhiều lần trong giờ...'
              }
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#8B1A4A]"
            />
          </div>

          {/* Continuous Adding Checkbox */}
          <div className="flex items-center space-x-2 pt-1">
            <input
              id="keep-open-checkbox"
              type="checkbox"
              checked={keepOpen}
              onChange={(e) => setKeepOpen(e.target.checked)}
              className="w-4 h-4 text-[#8B1A4A] rounded border-slate-300 focus:ring-[#8B1A4A]"
            />
            <label htmlFor="keep-open-checkbox" className="text-xs text-slate-600 select-none cursor-pointer">
              Tiếp tục tạo thêm ghi nhận khác sau khi lưu
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#8B1A4A] hover:bg-[#72153c] shadow-sm flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Đang lưu...' : 'Lưu ghi nhận'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
