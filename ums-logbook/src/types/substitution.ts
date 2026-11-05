/**
 * UMS SmartConnect - Dạy thay (GV xin nghỉ tự sắp xếp người dạy thay)
 * Collection: /substitutions/{id} — chỉ chứa thông tin lịch, KHÔNG chứa lý do nghỉ.
 */

export type SubstitutionStatus = 'planned' | 'approved' | 'cancelled';

export interface SubstitutionPlan {
  date: string; // YYYY-MM-DD
  classId: string;
  periodIndex: number; // 1..8
  subject: string;
  substituteUid: string;
  substituteName: string;
}

export interface Substitution extends SubstitutionPlan {
  id: string;
  leaveRequestId: string;
  absentUid: string;
  absentName: string;
  status: SubstitutionStatus;
  createdAt: number;
}
