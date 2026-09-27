# Chạy Expo khi đổi Wi-Fi

Trong `apps/mobile`, chạy `npm start`. Lệnh tự chọn IPv4 của adapter vật lý đang có gateway (ưu tiên Wi-Fi), truyền địa chỉ API cổng 8002 và địa chỉ Expo cho tiến trình Metro. Không sửa `.env` hay cấu hình production.

Lệnh kiểm tra IP mỗi 5 giây; khi IP đổi sẽ dừng riêng Metro do nó tạo rồi khởi động lại. Quét QR Expo mới trên điện thoại sau khi đổi mạng. Nếu mất Wi-Fi tạm thời, lệnh chờ có mạng trở lại. Dùng Ctrl+C để dừng.

- `npm run start:check`: xem địa chỉ được chọn, không mở hoặc dừng Metro.
- `npm run start:manual`: dùng Expo CLI nguyên bản (ví dụ cấu hình API hosted hoặc tunnel).
- Có nhiều adapter: đặt `AUDIOTOUR_LAN_IP` để chỉ định IPv4; bỏ biến này để trở lại tự nhận.
- Cổng 8081 đang có Metro khác: dừng terminal cũ trước; lệnh không tự giết tiến trình bên ngoài.

Content API cần đang chạy ở `0.0.0.0:8002`. Chế độ LAN dùng API local cổng 8002 và ưu tiên địa chỉ tự nhận hơn EXPO_PUBLIC_API_BASE_URL trong `.env`, chỉ trong tiến trình con.

Cùng Wi-Fi không bảo đảm các thiết bị được phép truy cập nhau: router/AP isolation hoặc Windows Firewall có thể chặn. Kiểm tra từ trình duyệt điện thoại `http://IP:8081/status` và `http://IP:8002/health`. Tự nhận IP không vượt qua các chặn mạng này. Expo tunnel chỉ chuyển đường Metro; backend LAN vẫn cần đường kết nối riêng.
