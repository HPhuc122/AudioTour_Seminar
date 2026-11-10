# AudioTour mobile

Ứng dụng dành cho khách tham quan, dùng React Native và Expo. Mã giao diện nằm ở `App.tsx` và `src/native/`; nội dung POI, Tour, QR, audio và tuyến đường lấy từ `services/content-service` qua API.

Trong thư mục này, chạy `npm ci` để cài dependency và `npm start` để mở Expo qua Wi-Fi. Content API cần chạy riêng ở `0.0.0.0:8002`; xem `scripts/README.md` để biết cách chọn IP và kiểm tra kết nối. Chạy `npm run typecheck` để kiểm tra TypeScript.

Mobile tiếp tục dùng một địa chỉ API ở cổng **8002**. Để admin ghi nhận thiết bị, chạy thêm Auth ở cổng **8001**; Content chuyển tiếp `POST /api/v1/auth/register-device` tới `AUTH_SERVICE_URL` (mặc định `http://127.0.0.1:8001`). Có thể chạy toàn bộ backend bằng `powershell -ExecutionPolicy Bypass -File scripts/start-backend.ps1` từ thư mục gốc. Điện thoại không cần truy cập trực tiếp cổng 8000 hoặc 8001. Sau khi đổi URL API, dừng Expo và chạy lại `npm start`.
