/**
 * Test Fixtures & Seed Data for UMS Logbook E2E Tests
 * Derived from ORIGINAL_REQUEST.md & PROJECT.md
 */

export interface FixtureStudent {
  stt: number;
  mhs: string;
  name: string;
  dob: string;
  gender: 'Nam' | 'Nữ';
  class: string;
}

export interface FixtureClass {
  classId: string;
  gvcnUsername: string;
  gvcnName: string;
  students: FixtureStudent[];
}

export interface FixtureUser {
  username: string;
  name: string;
  roles: ('admin' | 'gvcn' | 'gvbm' | 'tpt' | 'parent')[];
  assignedClassId?: string;
}

export const FIXTURE_USERS: Record<string, FixtureUser> = {
  mrlinhums: {
    username: 'mrlinhums',
    name: 'Hồ Thanh Quang Uyên (Mr. Linh)',
    roles: ['admin', 'gvcn'],
    assignedClassId: '8A3',
  },
  mshuyentrangums: {
    username: 'mshuyentrangums',
    name: 'Nguyễn Phương Minh Hạnh',
    roles: ['admin', 'gvcn'],
    assignedClassId: '7A3',
  },
  mrhoanggiangums: {
    username: 'mrhoanggiangums',
    name: 'Hoàng Giang',
    roles: ['admin'],
  },
  mrhoanglongums: {
    username: 'mrhoanglongums',
    name: 'Hoàng Long (TPT)',
    roles: ['tpt'],
  },
  msphuonganhums: {
    username: 'msphuonganhums',
    name: 'Đinh Hoài Long',
    roles: ['gvcn', 'gvbm'],
    assignedClassId: '6A1',
  },
  mrlinh9a3ums: {
    username: 'mrlinh9a3ums',
    name: 'Nguyễn Mạnh Linh',
    roles: ['gvcn', 'gvbm'],
    assignedClassId: '9A3',
  },
  gvbm_math: {
    username: 'mrthanhmathums',
    name: 'Trần Văn Thành',
    roles: ['gvbm'],
  },
};

export const FIXTURE_STUDENTS_6A1: FixtureStudent[] = [
  { stt: 1, mhs: '269398', name: 'Lý Bảo Duy', dob: '2015-07-12', gender: 'Nữ', class: '6A1' },
  { stt: 2, mhs: '269048', name: 'Đinh Minh Tùng', dob: '2015-05-07', gender: 'Nữ', class: '6A1' },
  { stt: 3, mhs: '269387', name: 'Tạ Hoài Thu Ngân', dob: '2015-03-18', gender: 'Nữ', class: '6A1' },
  { stt: 4, mhs: '269516', name: 'Dương Khánh Hiếu', dob: '2015-03-21', gender: 'Nữ', class: '6A1' },
  { stt: 5, mhs: '269594', name: 'Tạ Gia Thị Định', dob: '2015-12-11', gender: 'Nam', class: '6A1' },
];

export const FIXTURE_STUDENTS_8A3: FixtureStudent[] = [
  { stt: 1, mhs: '249694', name: 'Phan Hải Định', dob: '2013-02-15', gender: 'Nữ', class: '8A3' },
  { stt: 2, mhs: '249697', name: 'Lê Hoàng Nam', dob: '2013-06-20', gender: 'Nam', class: '8A3' },
  { stt: 3, mhs: '249807', name: 'Nguyễn Đức Minh', dob: '2013-09-05', gender: 'Nam', class: '8A3' },
];

export const DEFAULT_PASSWORD = 'demo@2026';
