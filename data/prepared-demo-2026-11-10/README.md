# Bản dịch và audio đã chuẩn bị cho AudioTour

Gói này chứa 72 MP3 của 12 POI ở 6 ngôn ngữ (vi, en, zh, ko, ja, fr),
72 bản nội dung POI và 18 bản nội dung Tour. Tour dùng audio của POI,
không có audio riêng. `audio.zip` khoảng 4,9 MB; mỗi file có SHA256 và thời lượng
trong `audio-manifest.json`.

Bản tiếng Việt giữ nội dung nguồn; bản ngoại ngữ được chuẩn bị sẵn cho demo
(`prepared-demo`), không phải kết quả dịch trực tuyến. Audio gồm 67 file Edge TTS
và 5 file tiếng Việt gTTS dự phòng. Có thể đọc/phát dữ liệu này mà không gọi
dịch/TTS; điện thoại vẫn cần kết nối backend để tải nội dung/audio.

## Đồng đội cập nhật trên máy của mình

1. Cập nhật mã nguồn và giữ `.env` riêng của máy. Cấu hình `SQLSERVER_*` trỏ tới
   CSDL demo của bạn; chọn Windows Auth hoặc SQL Auth theo môi trường.
   Script cần Microsoft ODBC Driver 17 hoặc driver được cấu hình trong
   `SQLSERVER_ODBC_DRIVER`. Không dùng tài khoản hoặc `.env` của máy khác.
2. CSDL cần có schema hiện tại và bộ seed `data/vinh-khanh-demo/source.vi.json`
   (12 POI, 3 Tour, 6 ngôn ngữ). Nếu chưa có CSDL, cài requirements của Auth/Content
   rồi chạy `python scripts/initialize_local_database.py` như README gốc.
   Không reset CSDL đang có nội dung. Nếu dữ liệu nguồn hoặc ID khác, script dừng
   để tránh gắn audio sai POI hoặc ghi đè nội dung.
3. Từ thư mục gốc repo, dùng Python đã cài dependencies:

   ```powershell
   python -m pip install -r services/narration-service/requirements-demo-content.txt
   python scripts/import-demo-content.py
   python scripts/import-demo-content.py --apply
   ```

   Lệnh đầu tiên của script chỉ kiểm tra gói và CSDL, không ghi dữ liệu.
   `--apply` chép MP3 vào `MEDIA_ROOT/uploads/audio` và nhập các bản dịch,
   media, audio track và publication trong một giao dịch SQL. Không gọi mạng
   ngoài, không dịch hoặc tạo MP3 lại. Không đưa file receipt từ máy khác vào repo.
   Khi chạy lại, script xác minh batch trong CSDL và không thêm trùng; có thể
   khôi phục MP3 bị thiếu từ ZIP. File cùng tên nhưng khác SHA256 không bị ghi đè.
4. Chạy Auth ở 8001 và Content ở 8002. Mobile tiếp tục dùng 8002; chạy lại
   `npm start` trong `apps/mobile` để nạp URL của máy mình. Chọn một POI và ngôn ngữ,
   mở quyền nghe theo luồng hiện có rồi phát audio.

Nếu dùng venv, thay `python` bằng đường dẫn Python trong venv. File cấu hình
`MEDIA_ROOT` tương đối được hiểu từ gốc repo. SQL Auth dùng `SQLSERVER_USER` và
`SQLSERVER_PASSWORD`; Windows Auth dùng `SQLSERVER_USE_WINDOWS_AUTH=true`.

Gói không chứa tài khoản, token, mật khẩu, lịch sử thanh toán, cache adapter
hoặc bản backup toàn bộ CSDL. Ảnh nguồn đã có ở `data/vinh-khanh-demo/images`,
kèm thông tin quyền sử dụng trong `image-rights.csv`.

## Nội dung tạo mới sau demo

Xem `docs/guides/demo-narration-adapter.md` để bật MyMemory/Edge TTS khi cần
xử lý nội dung mới. Không cần bật automation hay provider để nhập/phát gói có sẵn.
