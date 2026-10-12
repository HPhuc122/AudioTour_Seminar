# AudioTour Web CMS

React.js Web dành riêng cho chủ sạp/người quản lý. Khách tham quan sử dụng Mobile React Native; FastAPI phục vụ cả hai ứng dụng.

- / và /admin chuyển đến Dashboard; chưa đăng nhập chuyển đến /login.
- /admin: Dashboard, POI, tour và thứ tự điểm dừng, bản dịch POI/tour, hình ảnh, audio/TTS, tạo và tải QR, bản đồ, người dùng, analytics.
- Bản đồ quản trị cho phép chọn POI, nhấp để đặt tọa độ, nhập tọa độ/bán kính và lưu. AnalyticsViewer chỉ xem.
- Admin/SuperAdmin quản lý người dùng; ContentAdmin/TourOperator và Admin/SuperAdmin được sửa nội dung. AnalyticsViewer chỉ đọc. Backend kiểm tra vai trò độc lập với Web.
- QR tải xuống chứa mã Code để Mobile gửi đến API resolve; không còn trỏ đến route khách trên Web.
- Nghe file/TTS chỉ để kiểm tra nội dung quản trị; không ghi lượt nghe khách. TTS hiện nghe thử bằng trình duyệt, chưa tạo file TTS thật.
- Các route khách /pois, /tours, /map, /qr, /access (kể cả trang chi tiết) đã gỡ khỏi router và điều hướng. Web không khởi tạo NarrationProvider, GPS, geofencing hay camera quét QR.
- Source Public và các helper cũ giữ lại nhưng không nối vào ứng dụng. Không xóa module/API dùng chung và không sửa apps/mobile.

## Kiểm tra

Trong apps/web chạy npm run build, npm run lint, npm test và npm run test:e2e. E2E mặc định mock API để kiểm tra điều hướng/phân quyền và lưu vị trí; AUDIOTOUR_LIVE=1 bật kiểm tra gateway thật. Cần Chromium của Playwright hoặc WEB_BROWSER_CHANNEL=msedge.
