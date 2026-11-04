# Điều chỉnh nghiệp vụ âm thanh — 04/11/2026

Luồng chính: Chủ sạp nhập văn bản thuyết minh → Admin duyệt văn bản → worker chuyển văn bản thành giọng nói → Mobile stream file đã tạo. Không yêu cầu tải bản thu âm lên, không yêu cầu duyệt media và track riêng. File và track tự sinh kế thừa lần duyệt văn bản.

## File thay đổi

- `apps/web/docs/src/pages/admin/ContentConsole.tsx`: bỏ thêm file và sửa/xóa audio trực tiếp; dẫn về văn bản nguồn, hiển thị trạng thái TTS.
- `apps/web/docs/src/pages/vendor/VendorPois.tsx`, `VendorRelatedContent.tsx`: tương tự cho Chủ sạp, giữ phạm vi POI sở hữu.
- `apps/web/docs/src/components/NarrationAudioStatus.tsx`: đọc API trạng thái theo quyền và POI, hiển thị chờ/đang tạo/thành công/thất bại/bản cũ; nút cập nhật; thông báo khi máy chủ chưa cấu hình.
- `ContentPreviewDialog.tsx`: sửa hướng dẫn khi chưa có file, chỉ dùng nghe thử văn bản trên trang văn bản/bản dịch; audio kết quả nghe file đã tạo.
- Xóa component `AudioUploadDialog.tsx` và các ca giao diện chỉ kiểm tra upload thủ công; thay bằng `tests/e2e/text-to-speech.spec.ts`. Cập nhật `admin-management.spec.ts`.
- `services/content-service/app/services/narration_jobs.py`: track sinh ra có `AudioType=tts`, `TTSText` và `AutomationJobId`, vẫn lưu file thật. Giữ kiểm tra phiên bản, lease và đầu văn bản trước khi công khai.
- `services/content-service/tests/test_tts_publication.py`: kiểm tra kết quả TTS và chặn phiên bản cũ bằng mock, không duyệt nội dung thật.
- Cập nhật README Web, hướng dẫn chạy chung Web/Mobile, checklist Android và hợp đồng narration automation.

## Kiểm tra

- Web build/lint đạt; 27 unit test đạt.
- 28 ca E2E liên quan Admin, Chủ sạp, xem trước và TTS đạt sau chạy lại 3 ca: hai ca mới cần sửa selector nhãn có dấu bắt buộc; một ca ảnh nhiều kích thước bị timeout khi chạy song song và đạt khi chạy riêng.
- Content: 93 ca, 38 đạt và 55 ca SQL opt-in bỏ qua. Không bật test duyệt nội dung SQL. Hai ca publication TTS mới dùng mock.
- GET API CMS Admin/Vendor trên SQL Server hiện có đạt, gồm trạng thái TTS và kiểm tra quyền 401/403. Content đã khởi động lại, Web đang chạy tại `http://localhost:5173`.
- Không tạo/reset/xóa database, không tự duyệt dữ liệu, không commit/push.

## Còn thiếu

Máy chưa cấu hình endpoint TTS/dịch hoặc khóa dịch vụ, worker tự động đang tắt. Cần cấu hình dịch vụ thật theo `azure-narration-adapter.md` và hợp đồng `../api-contracts/narration-automation.md`, rồi người phụ trách duyệt văn bản thật. Tiếng Việt dùng trực tiếp văn bản nguồn; ngoại ngữ cần dịch vụ dịch.

Chưa xác nhận tạo giọng thật hoặc nghe trên Android thật. Nghe thử bằng giọng trình duyệt không đồng nghĩa đã có file TTS xuất bản. API upload cũ giữ tương thích dữ liệu, không còn là luồng nhập audio trên giao diện.
