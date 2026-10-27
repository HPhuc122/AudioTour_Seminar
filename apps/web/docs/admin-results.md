# Kết quả Web Admin — 14/10/2026

## Phạm vi đã triển khai

Đọc schema SQL Server thật trước khi code, gồm cột/default/check constraints và FK. Không sửa apps/mobile; không commit/push; không áp dụng migration đề xuất; không duyệt hoặc sửa dữ liệu nghiệp vụ cũ trong quá trình triển khai. Test SQL dùng transaction rollback, file thử được dọn.

- Admin yêu cầu đăng nhập, gọi DB thật qua Gateway. Không thay lỗi API bằng dữ liệu mẫu.
- Sidebar phân nhóm; dashboard có số tổng, hàng đợi, cảnh báo thiếu file, thời hạn; thống kê theo ngày UTC và tên POI.
- Catalog POI/Tour/nội dung/ảnh/audio/người dùng/ngôn ngữ tìm kiếm/lọc/phân trang trong SQL, lọc scope cả count và rows.
- Hồ sơ duyệt trả canonical và đề xuất riêng; so sánh text, xem trước file, xác nhận approve, lý do reject bắt buộc, thông báo kết quả. Giữ canonical và bytes public đến khi duyệt.
- Tour chọn POI từ danh sách thật và sắp xếp điểm dừng qua proposal.
- Trang chủ sạp tra cứu user/POI sở hữu/grants, chưa gán trạng thái duyệt giả.
- Trang thời hạn dùng ValidFrom/ValidUntil, validate ngày và timezone, staging qua ContentSubmissions.
- Trang giao dịch chỉ tra cứu hai bảng session thật, ghi rõ SimulatedMoMo và thiếu đối soát. Backend chặn mark-paid và payload PaymentStatus không có bằng chứng.
- Ngôn ngữ có CRUD API thật; validation tên/mã và chống đổi Code. User writes kiểm tra dữ liệu bắt buộc, email, độ dài SQL, vai trò và trùng tài khoản.
- Adapter dịch/TTS thật dùng URL server cấu hình, input canonical Approved, kiểm Version, ghi audit, chống tạo trùng. Output dịch/media/audio Pending; hook sau approval được bật bằng biến môi trường. Provider chưa cấu hình, tính năng tự động chưa bật.
- Thư viện audio có nút **Thêm file âm thanh**: chọn POI, file, tên, ngôn ngữ rồi lưu. Dùng media/upload và audio API hiện có để lưu file thật/AudioTracks. Không yêu cầu nhập FileUrl. Tạo bản ghi lỗi thì retry dùng lại media đã tải, không upload trùng. Audio không mang ImageCategory của ảnh.

## Kiểm thử đã xác nhận

| Kiểm tra | Kết quả |
| --- | --- |
| Web TypeScript + Vite build | PASS |
| Web ESLint | PASS |
| Web Vitest | 21/21 PASS |
| Content Backend | 39/39 PASS, gồm 20 integration SQL Server thật |
| Auth Backend | 7/7 PASS |
| Python Ruff E9,F và compileall | PASS |
| E2E Admin trước bổ sung form audio | 32/32 PASS: 16 nghiệp vụ/quyền/viewport và 16 trang Gateway/DB thật |
| E2E thêm audio và retry | 2/2 PASS, lưu POI/ngôn ngữ và không upload trùng khi retry |
| Gateway qua proxy Web | Catalog, queue/dossier, summary/statistics, vendors, validity, transactions, capabilities, automation: 200; Vendor admin-only: 403; anonymous CMS: 401 |
| git diff --check; apps/mobile | PASS; không có thay đổi Mobile |

E2E nghiệp vụ upload dùng fixture ở lớp test, không thêm file giả vào DB/Admin thực tế. SQL integration kiểm binary WAV tạm, scope, proposal và rollback. Các trang thật được kiểm tra read-only với JWT Admin ngắn hạn, không in token hoặc mật khẩu. Kiểm thử provider dùng response fixture; chưa xác nhận chất lượng dịch/giọng đọc của provider thật.

## Chưa hoàn thành do cần xác nhận

- Duyệt chủ sạp: DB chưa có hồ sơ/stage/rejection reason. Users.IsActive không thay cho approval. Cần thông tin hồ sơ và quy tắc cấp quyền.
- Danh mục gói, đăng ký/gia hạn: chưa có bảng gói; cần đối tượng, giá/thời hạn và chính sách gia hạn.
- Đối soát thanh toán: chưa có transaction ID/evidence/signature. Không công nhận Paid hoặc mô phỏng là giao dịch hợp lệ.
- Dịch/TTS tự động thực tế: cần nhà cung cấp/adapter/credentials; chưa có provider được cấu hình. Có API thật và hook, chưa chạy với dịch vụ trả phí.
- 46 media gốc vẫn thiếu file trên máy, cần khôi phục/upload file thật. Không tự tạo nội dung thay thế.
- Job automation Started bị process dừng chưa có worker recovery tự động; cần vận hành có kiểm soát hoặc giai đoạn worker riêng.

[Bảng audit](admin-audit.md) · [Đề xuất migration](admin-business-migration-proposal.md) · [SQL draft không thực thi](migrations/003_admin_business.proposed.sql) · [Contract provider](admin-provider-contract.md).
