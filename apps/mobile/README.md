# AudioTour mobile

Ứng dụng dành cho khách tham quan, dùng React Native và Expo. Mã giao diện nằm ở `App.tsx` và `src/native/`; nội dung POI, Tour, QR, audio và tuyến đường lấy từ `services/content-service` qua API.

Trong thư mục này, chạy `npm ci` để cài dependency và `npm start` để mở Expo qua Wi-Fi. Content API cần chạy riêng ở `0.0.0.0:8002`; xem `scripts/README.md` để biết cách chọn IP và kiểm tra kết nối. Chạy `npm run typecheck` để kiểm tra TypeScript.

Kiểm tra logic GPS/nhật ký bằng `node scripts/check-native-playback.cjs`, API bằng `node scripts/check-api-network.cjs`. [Checklist Android thật](../../docs/guides/android-integration-checklist.md) mô tả upload/duyệt audio, quyền khách, ảnh, QR, GPS và đối chiếu nhật ký. [Báo cáo tích hợp](../../docs/reports/mobile-integration-2026-11-04.md) ghi kết quả đã chạy và phần còn thiếu.

Home, danh sách và chi tiết hỗ trợ kéo để làm mới nội dung đã được duyệt; quay lại app từ nền cũng tải lại dữ liệu. Vé dùng deadline chung giữa các màn hình và player kiểm tra thời hạn truy cập. `node scripts/check-access-session.cjs` kiểm tra UTC, thời gian nền và dữ liệu SecureStore. [Cách chạy Web và Mobile cùng nhau](../../docs/guides/run-web-mobile-together.md).
