/**
 * UMS Brand Identity & Theme Configuration
 * School: Trường THCS Ngoại ngữ (ULIS Middle School - UMS)
 */

export const BRAND_CONFIG = {
  schoolNameVi: 'TRƯỜNG THCS NGOẠI NGỮ',
  schoolNameEn: 'ULIS MIDDLE SCHOOL (UMS)',
  subTitleVi: 'Đại học Quốc gia Hà Nội',
  subTitleEn: 'Vietnam National University, Hanoi',
  // Tên nền tảng chung (2026-10-10). Sổ đầu bài là một phân hệ bên trong.
  platformName: 'UMS SmartConnect',
  platformShort: 'UMS+',
  sloganVi: 'Một nền tảng – Bốn vai trò – Một trường học thông minh',
  sloganEn: 'One platform – Four roles – Our smart school',
  appTitleVi: 'SỔ ĐẦU BÀI ĐIỆN TỬ',
  appTitleEn: 'DIGITAL CLASS LOGBOOK',
  academicYear: '2026-2027',
  logoPath: '/logo.jpg',
  colors: {
    primary: '#8B1A4A',
    primaryDark: '#6B1338',
    primaryLight: '#F8EBF0',
    primaryAccent: '#DF3B7E',
    bgLight: '#F8FAFC',
    cardBg: '#FFFFFF',
  },
  meta: {
    grades: [6, 7, 8, 9],
    totalPeriodsPerDay: 8,
    morningPeriods: [1, 2, 3, 4],
    afternoonPeriods: [5, 6, 7, 8],
    idleTimeoutMinutes: 30,
    warningTimeoutMinutes: 28,
  }
};
