# Tự đồng bộ mô tả sửa trực tiếp trong SQL

Content Service kiểm tra một lần mỗi lần tiến trình backend khởi động, kể cả
khởi động do auto-reload. Công việc chạy nền, không bắt trang chủ phải chờ TTS.
Mặc định `NARRATION_DB_SYNC_ENABLED=true`; đặt `false` và restart Content để
tắt bước phát hiện tự động. Không cần migration hoặc thêm cột mới.

## Cách dùng

Sửa trực tiếp **`POITranslations.Description`** của địa điểm, ví dụ:

```sql
UPDATE POITranslations
SET Description = N'New English description for this place.'
WHERE POIId = 1 AND LanguageCode = 'en' AND IsDeleted = 0;
```

Sau đó khởi động lại backend. Chỉnh dữ liệu trong SQL không phát sinh sự kiện
auto-reload file Python; có thể dùng:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-backend.ps1 -Restart
```

Không cần tăng `Version` hoặc sửa `UpdatedAt`, không cần gửi duyệt trên web.
Hệ thống so sánh mô tả hiện tại với nội dung thực tế của publication đã phát:

- Một ngôn ngữ thay đổi: dùng mô tả đó và mã ngôn ngữ của nó làm nguồn.
- Nhiều ngôn ngữ thay đổi: dùng **`POIs.Description` tiếng Việt** làm nguồn.
  Hãy bảo đảm cột này chứa nội dung chuẩn; các bản dịch vừa sửa sẽ được thay
  bằng nội dung dịch từ nguồn dự phòng đó.
- Nguồn rỗng hoặc tiếng Việt dự phòng không được bật: ghi log và giữ publication cũ.
- Không thay đổi: không tạo batch/job/audio mới. Khác biệt xuống dòng CRLF/LF và
  khoảng trắng ở hai đầu được bỏ qua khi so sánh.

Cơ chế áp dụng cho POI đang bật, chưa xóa và đã có nguồn thuyết minh/publication
để đối chiếu. Chỉ kiểm tra các bản dịch chưa xóa, được duyệt và thuộc ngôn ngữ
đang bật. Bài nguồn bị xóa mềm không được tự phục hồi. Nội dung tạo mới hoàn toàn
chưa có publication vẫn dùng luồng biên soạn/duyệt hiện có. Tour không tạo audio
riêng; cơ chế này không đồng bộ `TourTranslations`.

## Kết quả

Mỗi ngôn ngữ đang bật được tạo job dịch và TTS, gồm cả ngôn ngữ nguồn (chỉ cần
TTS cho nguồn). Tên địa điểm hiện có theo từng ngôn ngữ được giữ; mô tả dài và
mô tả ngắn được cập nhật, bản ngắn tối đa 500 đơn vị UTF-16. Mỗi cặp mô tả/audio
được công bố cùng nhau khi thành công. Audio trước đó chuyển `IsActive=0`;
file cũ và lịch sử được giữ. Các ngôn ngữ có thể hoàn tất ở thời điểm khác nhau.

Batch đồng bộ SQL được tự xử lý mà không cần bật `ADMIN_AUTOMATION_ENABLED`;
cờ này vẫn điều khiển các job thông thường. Adapter dịch/TTS, token nội bộ và
các URL provider vẫn phải được cấu hình và dịch vụ Narration phải chạy. Cần
Internet để tạo mới. Không có cam kết tạo xong ngay khi `/health` trả `ok`.

Nếu provider lỗi, publication cũ vẫn được giữ và job dùng cơ chế retry/cooldown
hiện có. Restart dùng lại batch chưa hoàn tất, không tạo bản sao; các job `Failed`
được mở lại để thử, giữ thời điểm chờ đã có. Nếu sửa mô tả tiếp trong lúc batch
chạy, job cũ không được ghi đè bản sửa mới; khởi động backend lại để nhận thay đổi.

## Theo dõi

```powershell
Get-Content .runtime/content.stderr.log -Tail 30 -Wait
```

Log ghi POI, ngôn ngữ nguồn và trạng thái, không ghi nội dung mô tả. Batch được
ghi rõ `origin=database-description-sync` trong `ContentSubmissions.PayloadJson`
và audit action `DBSync`, không giả là thao tác duyệt thủ công. ID admin đang
hoạt động được dùng làm liên kết FK cho tác vụ hệ thống; cần có một admin hợp lệ.

Theo dõi `NarrationJobs.Status`, `ErrorCode`, `ErrorMessage` hoặc trang automation.
Sau khi hoàn tất, tải lại chi tiết POI/chọn lại ngôn ngữ trên mobile để lấy audio
và nội dung mới. Không cần dịch lại ở phía mobile.
