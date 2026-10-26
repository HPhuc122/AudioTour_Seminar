# Cập nhật Web Admin và Chủ sạp — 26/10/2026

## Thay đổi đã thực hiện

Sửa bản web thực sự đang chạy trong `apps/web/docs/src`; không sửa Mobile và không thay dữ liệu thật.

### Admin

- Xem trước thuyết minh, bản dịch, ảnh và audio trong dialog; đóng bằng Escape, trả focus về nút mở, khóa cuộn nền và thu hồi URL media khi đóng.
- Nghe đúng endpoint bản ghi audio hoặc file của submission đang chờ duyệt. Báo rõ HTTP 403/404, file rỗng và lỗi định dạng; không thay bằng file mẫu.
- Hiển thị thông báo thành công sau upload audio; giữ khả năng thử tạo lại bản ghi bằng file đã upload, không tải trùng.
- Thêm sửa tên, ngôn ngữ, thời lượng và hoạt động của audio, giữ đường dẫn file hiện tại.
- Hiển thị lỗi duyệt ngay trong dialog xác nhận để lỗi phiên bản hoặc lỗi máy chủ không bị che sau lớp phủ.
- Đổi loại nội dung quản lý sẽ khởi tạo lại bộ lọc/trang/form, tránh mang trạng thái POI sang Tour hoặc tài khoản.
- Sửa bố cục biểu đồ, bảng nội dung, nút thay ảnh và nút đăng xuất ở màn hình nhỏ. Xóa hai import không dùng gây lỗi lint.

### Chủ sạp

- Nội dung POI có tìm kiếm, lọc trạng thái và phân trang; không giới hạn hiển thị ở 100 bản ghi đầu tiên như trước.
- Thêm/sửa bản dịch; thêm/sửa thuyết minh; sửa thông tin audio.
- Xem trước nội dung trong dialog, lấy đúng file theo SubmissionId khi có đề xuất đang chờ duyệt.
- Thay ảnh, gửi yêu cầu xóa ảnh/audio/thuyết minh/bản dịch; chỉ gửi vào quy trình duyệt.
- Hồ sơ gửi duyệt có tên loại nội dung tiếng Việt, xem chi tiết và so sánh bản hiện tại/đề xuất, lý do từ chối, xem media và mở đúng nội dung để chỉnh sửa.
- Gửi lại hồ sơ bị từ chối và hiển thị kết quả thao tác.
- Lưu tab chi tiết POI trên URL để liên kết từ hồ sơ mở đúng tab. Kiểm tra page URL hợp lệ và giới hạn bán kính 10.000 m.
- Có đăng xuất trên thanh đầu trang khi sidebar thu gọn.

### Kiểm thử

- Cập nhật bài E2E theo giao diện đăng nhập và khu vực Vendor riêng; cập nhật fixture automation theo contract tác vụ hiện tại.
- Bỏ đường dẫn `/admin/plans` khỏi danh sách live smoke vì ứng dụng hiện không có route này; không tạo chức năng gói dịch vụ giả.
- Bổ sung 14 bài E2E: quản lý tài khoản, cấp/thu hồi quyền, thứ tự Tour/bản dịch, sửa audio, reset bộ lọc, lỗi duyệt, Vendor CRUD nội dung, media, hồ sơ, thống kê và đăng xuất.
- Thêm `scripts/check_web_console.py` kiểm tra chỉ đọc API CMS bằng SQL Server thật, JWT cục bộ ngắn hạn của tài khoản sẵn có; không kiểm thử đăng nhập bằng mật khẩu và không khởi động narration worker.

## Kết quả cuối

| Kiểm tra | Kết quả |
| --- | --- |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run lint` | PASS |
| `npm.cmd test` | 27/27 PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:e2e -- --workers=2` | 41 PASS, 16 SKIP, 0 lỗi |
| API CMS đọc SQL Server thật | PASS cho Admin và Vendor |
| Phân quyền API thật | Anonymous 401; Vendor 403 khi vào Users/Languages/Vendors/Validity/Transactions/Capabilities |
| `git diff --check` | PASS |

Kiểm thử UI dùng fixture API, có xác nhận request/payload và giao diện. 16 bài bỏ qua gồm 15 live Admin smoke cần session và 1 Gateway probe cần cấu hình opt-in; không tính là PASS. Script API thật kiểm tra Content service qua FastAPI TestClient và SQL Server, không chứng minh đường mạng Gateway hoặc đăng nhập bằng mật khẩu. Chưa thực hiện thao tác ghi/phê duyệt trên DB thật.

Kiểm tra dialog ảnh ở 1440/768/390 px đạt; đã xem ảnh chụp tại 390 px. Dashboard được kiểm tra 1440/1024/768 px. Đăng xuất Admin/Vendor được kiểm tra ở 390 px.

## Điều kiện dữ liệu và dịch vụ còn lại

- DB thật có 47 metadata media chưa xóa, 1 file hiện diện và **46 file bị thiếu**. Web báo lỗi và cho tải/thay file; cần khôi phục media hoặc upload file thật trước khi demo toàn bộ dữ liệu cũ.
- Tour/audio cũ vẫn còn Pending; không tự duyệt để tạo dữ liệu demo.
- Dịch/TTS tự động cần cấu hình provider và kiểm tra live. Thay đổi lần này không bật dịch vụ sinh audio và không xác nhận kết quả provider ngoài hệ thống.
- Thanh toán, mua gói/gia hạn và duyệt hồ sơ kinh doanh đầy đủ chưa có nghiệp vụ/API hoàn chỉnh trong phạm vi hiện tại; không mô tả các trang tra cứu là đã hỗ trợ thanh toán thật.

Các kiểm thử mới giúp xác nhận luồng Web Admin/Chủ sạp đã sửa. Nghiệm thu triển khai vẫn cần backend/Gateway chạy đúng cấu hình, phiên đăng nhập thật và media thực tế.
