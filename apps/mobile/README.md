# AudioTour mobile

Ứng dụng dành cho khách tham quan, dùng React Native và Expo. Mã giao diện nằm ở `App.tsx` và `src/native/`; nội dung POI, Tour, QR, audio và tuyến đường lấy từ `services/content-service` qua API.

Trong thư mục này, chạy `npm ci` để cài dependency và `npm start` để mở Expo qua Wi-Fi. Content API cần chạy riêng ở `0.0.0.0:8002`; xem `scripts/README.md` để biết cách chọn IP và kiểm tra kết nối. Chạy `npm run typecheck` để kiểm tra TypeScript.
