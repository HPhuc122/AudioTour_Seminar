# Thống kê thiết bị trên dashboard Admin

Đã bổ sung mục Thiết bị truy cập trên `/admin/dashboard`, chỉ hiển thị và cho API đọc bởi Admin/SuperAdmin.

- Ba chỉ số: thiết bị hoạt động trong 5 phút gần nhất, tài khoản hoạt động (đếm UserId khác nhau), tổng thiết bị ghi nhận của tài khoản còn hoạt động và khách.
- Bảng có tài khoản/vai trò, số thiết bị hoạt động của tài khoản đó, mã thiết bị, nền tảng, lần truy cập và trạng thái; có tìm kiếm, lọc chỉ hoạt động và phân trang 20 dòng.
- Bộ đếm dùng thời gian SQL Server UTC, không dùng đồng hồ trên client để quyết định online. Tài khoản bị vô hiệu hóa không được tính.
- Web dùng ID ngẫu nhiên lưu theo tài khoản trong localStorage, dùng chung giữa các tab cùng trình duyệt. Sau đăng nhập và mỗi 60 giây khi tab hiển thị, gọi `/api/v1/auth/me` với `X-Web-Device-Id`; backend lấy UserId từ JWT đã kiểm tra trạng thái tài khoản, không nhận UserId từ client. Khi logout/unmount, timer dừng. Bảng tự tải lại mỗi 30 giây và có nút làm mới.
- Bảng SQL `Devices` giữ lịch sử LastSeenAt; sau logout/đóng tab, có thể mất tối đa khoảng 5 phút để ra khỏi tập hoạt động, cộng chu kỳ làm mới bảng. Đây là hoạt động gần đây, không phải kết nối socket trực tuyến tức thời.
- Namespace `web-` không được ghi qua API register-device ẩn danh cũ. API danh sách không trả PushToken, password hay token đăng nhập.
- Migration `infra/sql/005_web_device_presence.sql` mở thêm Platform `web`, giữ android/ios/windows và dữ liệu cũ; đã áp dụng DB local. Dùng `scripts/migrate_device_presence.py` cho DB khác.
- Đã khởi động lại Auth/Content/Gateway để endpoint mới có hiệu lực.

Kiểm tra đã chạy: TypeScript, lint, 27 unit test Web, production build; 10 test Auth và 3 test Content dành cho feature. E2E có 5 test mới cho số liệu/tìm kiếm, tái sử dụng ID, heartbeat/dừng khi logout, hạn chế quyền, giao diện 390 px và retry lỗi dịch vụ. `scripts/check_device_activity.py` đã kiểm tra thành công Gateway + SQL thật: ghi đúng chủ tài khoản, hai heartbeat chỉ tạo một thiết bị, số thiết bị từng tài khoản, bộ lọc hoạt động và Vendor bị 403 khi đọc toàn hệ thống. Thiết bị thử được xóa sau kiểm tra.

Giới hạn: ID là hồ sơ trình duyệt theo tài khoản, không nhận diện phần cứng tuyệt đối; xóa localStorage/đổi trình duyệt tạo ID mới. Native Mobile hiện chưa gửi heartbeat theo chu kỳ nên không coi bảng này là toàn bộ điện thoại đang mở ứng dụng. Bản ghi Mobile cũ chỉ phản ánh LastSeenAt mà API hiện có đã ghi nhận.

Kết quả cuối toàn bộ E2E Web: **46 PASS, 16 SKIP, 0 lỗi**. Các bài live Admin cần session riêng vẫn được bỏ qua; kiểm tra live Gateway/SQL của tính năng thiết bị đã chạy bằng script nêu trên. Sau khi bổ sung xác nhận số thiết bị từng tài khoản vào fixture, 5/5 bài E2E riêng của tính năng tiếp tục đạt.
