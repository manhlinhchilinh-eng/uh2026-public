/**
 * UMS Digital Class Logbook - Seed Data Pipeline & Loader
 */
import rawClassData from '../../data/class_data.json';
import { ClassDoc, StudentDoc, UserDoc, ScoringConfigDoc, UserRole } from '../types';
import { DEFAULT_PASSWORD_HASH } from '../utils/crypto';

export interface SeedResult {
  classesCount: number;
  studentsCount: number;
  usersCount: number;
  success: boolean;
  message: string;
}

export const GVCN_USER_MAPPING: Record<string, { username: string; name: string; isAdmin?: boolean }> = {
  '6A1': { username: 'msphuonganhums', name: 'Đinh Hoài Long' },
  '6A2': { username: 'msmaihuong6a2ums', name: 'Phạm Hà Ánh Định' },
  '6A3': { username: 'mrlongums', name: 'Lý Trung Yến' },
  '6A4': { username: 'msphuonganh6a4ums', name: 'Trần Ngọc Đạt' },
  '6A5': { username: 'mshuyenums', name: 'Hồ Gia Trâm' },
  '6A6': { username: 'msquynhtrangums', name: 'Bùi Đức An Xuân' },
  '6A7': { username: 'mshienums', name: 'Nguyễn Minh Vy' },
  '6A8': { username: 'msngaums', name: 'Đặng Bảo Giang' },
  '7A1': { username: 'msthaoums', name: 'Phạm Hải Yến' },
  '7A2': { username: 'mrdatums', name: 'Đinh Trung Vy' },
  '7A3': { username: 'msthanhhuyenums', name: 'Nguyễn Phương Minh Hạnh', isAdmin: false },
  '7A4': { username: 'msquynhngaums', name: 'Lê Phương Quang Khoa' },
  '7A5': { username: 'mrhuyums', name: 'Lâm Phương Quân' },
  '7A6': { username: 'msthuytrangums', name: 'Nguyễn Văn Hạnh' },
  '8A1': { username: 'mshuonglyums', name: 'Dương Trung Hoài Châm' },
  '8A2': { username: 'mshongnhungums', name: 'Mai An Thanh Giang' },
  '8A3': { username: 'msngoclinhums', name: 'Hồ Thanh Quang Uyên' },
  '8A4': { username: 'mshangums', name: 'Mai Quang Hưng' },
  '8A5': { username: 'mshueums', name: 'Bùi Bảo Cường' },
  '8A6': { username: 'mshaiyen8a6ums', name: 'Lê Thị Khánh Châm' },
  '9A1': { username: 'msgiangums', name: 'Bùi Hoài Khánh Châm' },
  '9A2': { username: 'mshaiyen9a2ums', name: 'Lý Gia Đạt' },
  '9A3': { username: 'mrlinhums', name: 'Nguyễn Mạnh Linh', isAdmin: true },
  '9A4': { username: 'mrphuongums', name: 'Phạm Gia Ly' },
  '9A5': { username: 'msbaoums', name: 'Trần Bảo Tuệ Hiếu' },
  '9A6': { username: 'msmaiums', name: 'Phan Đức Tùng' },
};

export const ALL_CLASSES: string[] = Object.keys(GVCN_USER_MAPPING);

/**
 * Danh sách lớp cho ô chọn lớp (Sổ đầu bài, Điểm danh).
 * Thứ tự ưu tiên: localStorage `ums_classes` (nếu có lớp) → dữ liệu mẫu → 26 lớp cố định.
 * Bản production không nhúng class_data.json (dữ liệu mẫu rỗng) nên phải có lớp dự phòng,
 * nếu không ô chọn chỉ còn "Lớp 6A1" và GVCN lớp khác thấy sai tên lớp, BGH không đổi được lớp.
 * Luôn bổ sung lớp còn thiếu trong 26 lớp cố định (ums_classes cũ trong trình duyệt có thể thiếu lớp).
 */
const fallbackClassDoc = (id: string): ClassDoc => ({
  id,
  name: id,
  grade: parseInt(id[0], 10),
  room: `P.${id}`,
  gvcnId: GVCN_USER_MAPPING[id]?.username || `gvcn_${id.toLowerCase()}`,
  gvcnName: '', // tên trong GVCN_USER_MAPPING là tên demo — không hiện ra
  studentCount: 0,
  academicYear: '2026-2027',
  createdAt: 0,
});

export const loadClassOptions = (): ClassDoc[] => {
  let base: ClassDoc[] = [];
  try {
    const raw = localStorage.getItem('ums_classes');
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) base = parsed.filter((c) => c && typeof c.id === 'string' && c.id);
  } catch {
    // localStorage hỏng/không truy cập được → dùng nguồn tiếp theo
  }
  if (base.length === 0) base = generateSeedDataset().classes;
  const have = new Set(base.map((c) => c.id));
  const merged = [...base, ...ALL_CLASSES.filter((id) => !have.has(id)).map(fallbackClassDoc)];
  return merged.sort((a, b) => a.id.localeCompare(b.id, 'vi', { numeric: true }));
};

/** Bảo đảm lớp đang xem luôn có trong ô chọn (nếu thiếu, <select> sẽ hiện nhầm lớp đầu tiên). */
export const withSelectedClass = (list: ClassDoc[], selectedId: string): ClassDoc[] =>
  !selectedId || list.some((c) => c.id === selectedId) ? list : [fallbackClassDoc(selectedId), ...list];

export const DEFAULT_SCORING_CONFIG: ScoringConfigDoc = {
  criteria: [
    { id: 'learning', label: 'Học tập', maxPoints: 4.0, step: 0.5 },
    { id: 'discipline', label: 'Kỷ luật', maxPoints: 3.0, step: 0.5 },
    { id: 'hygiene', label: 'Vệ sinh / Ý thức', maxPoints: 2.0, step: 0.5 },
    { id: 'customCriterion', label: 'Phong trào / Tiêu chí khác', maxPoints: 1.0, step: 0.5 },
  ],
  maxTotal: 10.0,
  activeTerm: 1,
  activeWeek: 1,
  schoolYear: '2026-2027',
};

export interface MockUserDoc extends UserDoc {
  passwordHash: string;
}

export const generateSeedDataset = () => {
  const classes: ClassDoc[] = [];
  const students: StudentDoc[] = [];
  const users: MockUserDoc[] = [];
  const now = Date.now();

  const classDataRecord = rawClassData as Record<
    string,
    { gvcn: string; student_count: number; students: any[] }
  >;

  for (const [classId, classObj] of Object.entries(classDataRecord)) {
    const meta = GVCN_USER_MAPPING[classId];
    const grade = parseInt(classId[0], 10);

    classes.push({
      id: classId,
      name: classId,
      grade,
      room: `P.${classId}`,
      gvcnId: meta ? meta.username : `gvcn_${classId.toLowerCase()}`,
      gvcnName: meta ? meta.name : classObj.gvcn,
      studentCount: classObj.students.length,
      academicYear: '2026-2027',
      createdAt: now,
    });

    for (const s of classObj.students) {
      students.push({
        id: s.mhs,
        mhs: s.mhs,
        stt: s.stt,
        name: s.name,
        classId,
        grade,
        dob: s.dob,
        gender: s.gender as 'Nam' | 'Nữ',
        status: 'active',
        createdAt: now,
      });
    }

    if (meta) {
      const roles: UserRole[] = meta.isAdmin ? ['admin', 'gvcn', 'gvbm'] : ['gvcn', 'gvbm'];
      users.push({
        uid: `user_${meta.username}`,
        username: meta.username,
        email: `${meta.username}@ums.edu.vn`,
        displayName: meta.name,
        roles,
        assignedClassId: classId,
        mustChangePassword: true,
        passwordHash: DEFAULT_PASSWORD_HASH,
        createdAt: now,
      });
    }
  }

  // Principal account (BGH - Admin only)
  users.push({
    uid: 'user_mshuyentrangums',
    username: 'mshuyentrangums',
    email: 'mshuyentrangums@ums.edu.vn',
    displayName: 'Hiệu trưởng / Principal',
    roles: ['admin'],
    assignedClassId: undefined,
    mustChangePassword: true,
    passwordHash: DEFAULT_PASSWORD_HASH,
    createdAt: now,
  });

  // Admin-only account (BGH)
  users.push({
    uid: 'user_mrhoanggiangums',
    username: 'mrhoanggiangums',
    email: 'mrhoanggiangums@ums.edu.vn',
    displayName: 'Hoàng Giang',
    roles: ['admin'],
    assignedClassId: undefined,
    mustChangePassword: true,
    passwordHash: DEFAULT_PASSWORD_HASH,
    createdAt: now,
  });

  // TPT account
  users.push({
    uid: 'user_mrhoanglongums',
    username: 'mrhoanglongums',
    email: 'mrhoanglongums@ums.edu.vn',
    displayName: 'Hoàng Long',
    roles: ['tpt'],
    assignedClassId: undefined,
    mustChangePassword: true,
    passwordHash: DEFAULT_PASSWORD_HASH,
    createdAt: now,
  });

  return { classes, students, users, scoringConfig: DEFAULT_SCORING_CONFIG };
};

/**
 * Seeds local storage for mock/offline dev & unit test execution
 */
export const seedMockStorage = (): SeedResult => {
  const { classes, students, users, scoringConfig } = generateSeedDataset();
  try {
    localStorage.setItem('ums_classes', JSON.stringify(classes));
    localStorage.setItem('ums_students', JSON.stringify(students));
    localStorage.setItem('ums_users', JSON.stringify(users));
    localStorage.setItem('ums_scoring_config', JSON.stringify(scoringConfig));
    localStorage.setItem('ums_seeded', 'true');

    return {
      classesCount: classes.length,
      studentsCount: students.length,
      usersCount: users.length,
      success: true,
      message: `Đã khởi tạo thành công ${classes.length} lớp, ${students.length} học sinh và ${users.length} tài khoản giáo viên.`,
    };
  } catch (error: any) {
    return {
      classesCount: 0,
      studentsCount: 0,
      usersCount: 0,
      success: false,
      message: `Lỗi khởi tạo local storage: ${error.message}`,
    };
  }
};

export const getSeedStats = () => {
  return {
    classesCount: 26,
    studentsCount: 674,
    usersCount: 29,
  };
};
