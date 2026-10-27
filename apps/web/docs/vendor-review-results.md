# Luồng Vendor → Admin → API mobile — 25/10/2026

## Đã sửa

- Vendor tạo/sửa thuyết minh tại chi tiết POI, chọn ngôn ngữ từ API. Tạo dùng `POST /api/v1/narrations`; sửa dùng `PUT /api/v1/narrations/{id}/content` (không phải PUT trực tiếp vào `/narrations/{id}`). Lưu là gửi duyệt ngay theo cơ chế hiện có, không có bước lưu nháp riêng.
- Sau upload ảnh hoặc tạo audio, danh sách tự tải lại.
- Lịch sử POI dùng bộ lọc `poiId` ở Backend, bao gồm hồ sơ POI và các ảnh/audio/thuyết minh/bản dịch thuộc POI. Không so sánh nhầm EntityId của nội dung con với ID POI.
- Đăng ký Vendor dùng chung validation với tạo tài khoản: dữ liệu bắt buộc, email, giới hạn SQL/mật khẩu, trùng username/email. Role luôn được Backend chọn là Vendor.
- Báo cáo kiểm kê bổ sung ID media/POI, đường dẫn và danh sách AudioTracks thiếu file. Xem `media-inventory.json`.

## Các cơ chế có sẵn đã đối chiếu và giữ nguyên

- Backend scope theo `POIs.UserId` hoặc `EntityGrants`; áp dụng cả POI, nội dung con, preview và hồ sơ duyệt. Vendor không thể tự đổi chủ sở hữu hoặc duyệt nội dung.
- Update nội dung lưu vào ContentSubmissions; không cập nhật canonical trước duyệt. Từ chối bản sửa giữ nguyên bản Approved, lý do bắt buộc 1–1000 ký tự và Vendor xem được.
- Admin duyệt từng hồ sơ. Với audio: duyệt MediaFiles âm thanh trước, sau đó AudioTracks. Không có duyệt toàn bộ POI kèm nội dung con tự động.
- Duyệt thuyết minh xuất bản văn bản vào POITranslations cho API mobile. Ảnh/audio chỉ được API public trả về khi được duyệt và POI đủ điều kiện public.
- POI public cần IsActive, chưa xóa, ReviewStatus Approved, ApprovalStatus 1, LifecycleStatus 3 và trong thời hạn. Không bỏ qua yêu cầu thanh toán đã có trên dữ liệu cũ.
- `index.html` nạp `/docs/src/main.tsx`; `tsconfig.json` include `docs/src`; các test hiện trỏ tới `docs/src`. Vite dùng index.html ở apps/web. Giữ nguyên cấu trúc này, không chỉnh bản src cũ không được nạp.

## Kiểm tra tối thiểu

- PASS 5 kiểm tra SQL thật: scope Vendor, lọc lịch sử theo POI, approve/reject/resubmit giữ canonical, xuất bản thuyết minh, quyền truy cập ảnh/audio. Mỗi test rollback và dọn file thử, không thêm dữ liệu demo vào nghiệp vụ.
- PASS 1 unit test đăng ký: dữ liệu sai/trùng bị chặn, không cho chọn role Admin.
- PASS kiểm tra TypeScript chỉ lấy diagnostics của VendorPois.tsx.
- Không chạy E2E, lint/build hoặc toàn bộ bộ test. Chưa kiểm tra thao tác giao diện trực tiếp trên trình duyệt hay chạy mobile.

Chạy lại đúng 5 kiểm tra SQL từ root:

```powershell
$env:AUDIOTOUR_SQL_TESTS='1'
.tooling/python/python.exe scripts/test_vendor_review.py
```

## Dữ liệu còn chặn

Kiểm kê chỉ đọc xác nhận 47 bản ghi MediaFiles chưa xóa: 1 file có, 46 file thiếu. Có 20 AudioTracks chưa xóa trỏ tới file thiếu (có thể trùng với danh sách MediaFiles, không cộng thành 66 file). Danh sách đầy đủ có trong `media-inventory.json`: `missingMedia` và `missingAudio`. Cần khôi phục đúng file tại MEDIA_ROOT hoặc upload file thật rồi gửi duyệt; không tự duyệt dữ liệu cũ, không tạo file giả thay thế.

Kiểm kê tại thời điểm báo cáo có 4 POI đủ điều kiện public; các audio cũ và POITranslations cũ đang Pending. Không tự chuyển chúng thành Approved. Audio public cần guest access token hợp lệ, không bỏ cơ chế quyền nghe.

## Chạy thử bằng Vendor và Admin

Tại root, chạy mỗi service trong một terminal riêng:

```powershell
.tooling/python/python.exe scripts/serve.py auth
.tooling/python/python.exe scripts/serve.py content
.tooling/python/python.exe scripts/serve.py gateway
```

Terminal web:

```powershell
cd apps/web
npm.cmd run dev
```

1. Mở `http://localhost:5173/register`, đăng ký Vendor bằng username/email chưa dùng, rồi đăng nhập. Không chọn chế độ xem thử.
2. Tại `/vendor/pois/new`, tạo POI, bật hoạt động. Mở chi tiết POI; tải ảnh thật ở tab Hình ảnh, thêm file thật ở Âm thanh, thêm văn bản ở Thuyết minh. Các thao tác lưu/upload tự gửi hồ sơ Pending.
3. Dùng cửa sổ trình duyệt khác hoặc cửa sổ riêng tư đăng nhập tài khoản Admin/SuperAdmin đã có. Tới `/admin/review`, xem hồ sơ, văn bản và preview file. Duyệt POI, ảnh, media âm thanh, rồi bản ghi audio và thuyết minh. Nếu từ chối phải nhập lý do.
4. Vendor xem `/vendor/submissions`, lọc Bị từ chối để đọc lý do; sửa thuyết minh tại POI và gửi lại. POI sửa tại trang chỉnh sửa; có nút gửi lại hồ sơ bị từ chối ở danh sách submissions.
5. Kiểm tra `GET http://localhost:8000/api/v1/public/pois/{id}?lang=vi`: trước duyệt POI mới trả 404; sau duyệt đủ điều kiện trả POI, ảnh/audio đã duyệt và description từ thuyết minh. API mobile chi tiết nghe là `/api/v1/public/audio-tour/pois/{id}?languageCode=vi` với `X-Guest-Access-Token` hợp lệ; streamUrl của audio cũng yêu cầu token này. Ảnh đã duyệt dùng URL `/api/v1/public/media/images/{id}`.
6. Vendor sửa văn bản đã duyệt. Trước khi Admin duyệt, API public phải tiếp tục trả nội dung cũ; Admin từ chối thì vẫn giữ cũ; Vendor sửa/gửi lại và Admin duyệt thì API mới trả nội dung mới.

Để mobile trên điện thoại tải được ảnh/audio, cấu hình PUBLIC_API_BASE_URL ở Backend là địa chỉ Gateway mà điện thoại truy cập được (ví dụ IP LAN cổng 8000), không phải localhost trên điện thoại. Khởi động lại service sau đổi cấu hình. Không thay API/flow mobile hoặc tạo public web.

Không commit/push. Thay đổi package-lock.json đã có trước công việc này, không chỉnh sửa trong đợt hoàn thiện này.
