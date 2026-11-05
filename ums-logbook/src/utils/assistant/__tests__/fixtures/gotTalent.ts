/**
 * Fixture test: văn bản Got Talent mùa 5 (bản thật, tên học sinh đã thay bằng "HS A".."HS H";
 * giữ nguyên mã lớp, số liệu, ngày). Không thêm dữ liệu thật khác vào file này.
 */
import type { KnowledgeDoc } from '../../knowledgeDocs';

export const GOT_TALENT_TITLE = 'CÙNG UMS BÙNG NỔ VỚI CHUNG KẾT UMS GOT TALENT MÙA 5!';

export const GOT_TALENT_TEXT = `CHÚC MỪNG CÁC TIẾT MỤC VÀO VÒNG CHUNG KẾT UMS GOT TALENT MÙA 5!
Sau những ngày miệt mài luyện tập và thể hiện tài năng, UMS Got Talent mùa 5 đã ghi nhận sự tham gia của 19 tập thể và 20 cá nhân/nhóm với nhiều tiết mục đa dạng, sáng tạo và giàu màu sắc nghệ thuật.
Ban Tổ chức xin chúc mừng 18 tiết mục (10 tập thể và 8 cá nhân/nhóm) đã được lựa chọn bước tiếp vào vòng Chung kết!
 DANH SÁCH CÁC TIẾT MỤC VÀO VÒNG CHUNG KẾT
I. CÁC TIẾT MỤC TẬP THỂ
1. Lớp 6A1 – Hào khí Nam Quốc - Vũ đạo sử thi
2. Lớp 6A2 – Ước mơ của em
3. Lớp 6A6 – Dế Mèn phiêu lưu ký - Mùa hè lấp lánh
4. Lớp 6A8 – Dế Mèn phiêu lưu ký
5. Lớp 7A1 – Dáng hình bản sắc Việt
6. Lớp 7A3 – Để Mị nói cho mà nghe
7. Lớp 7A5 – Mashup Thị Mầu - Để Mị nói cho mà nghe - Rừng Mơ - Bóng phù hoa
8. Lớp 8A1 – Thanh âm sắc Việt
9. Lớp 8A2 – Tiếng ru cội nguồn
10. Lớp 8A4 – Mashup Bánh trôi nước - Chân ái

II. CÁC TIẾT MỤC CÁ NHÂN/NHÓM

1. HS A (6A3) – Piano: Nhớ về Hà Nội
2. HS B (6A3) – Violin: Merry-Go-Round of Life
3. HS C (6A5) – Đàn T'rưng: Anh hùng Núp & Tây Nguyên chào mặt trời
4. HS D (7A1) – Hát: Monster (Justin Bieber, Shawn Mendes)
5. HS E (7A6) – Đàn bầu: Hello Việt Nam
6. HS F (8A2) – Múa vòng
7. HS G (8A2) – Guitar: Maria Luisa
8. HS H (8A2) – Đàn tranh: Người gieo mầm xanh

Hẹn gặp lại tại ĐÊM CHUNG KẾT UMS GOT TALENT MÙA 5 với chủ đề “TỪ TRANG SÁCH LÊN SÂN KHẤU”, diễn ra vào ngày 13/11/2026. Cùng chờ đón những màn trình diễn thật bùng nổ nhé!`;

export function gotTalentDoc(text: string = GOT_TALENT_TEXT): KnowledgeDoc {
  return {
    id: 'got-talent-5',
    source: 'admin_doc',
    title: GOT_TALENT_TITLE,
    text,
    link: { path: '/hanh-chinh?open=got-talent-5', url: 'https://example.com/got-talent' },
  };
}
