# Đánh giá Web và Mobile ngày 26/10/2026

## Kết luận

Hai bên tương thích một phần ở cấp API và đã có nhiều màn hình nghiệp vụ. Chưa đủ điều kiện kết luận đồng bộ hoàn toàn hoặc hoàn thành tốt tất cả chức năng. Thiếu lớn nhất so với `tomtatyeucau.md` là geofencing tự kích hoạt thuyết minh trên Mobile, cơ chế ưu tiên/cooldown và dữ liệu thống kê nghe thực tế.

Đây là kiểm tra mã nguồn và kiểm thử tự động tại workspace hiện tại. Chưa kiểm thử trên điện thoại thật; backend local không kết nối được khi kiểm tra. Không sửa mã nghiệp vụ, không thay dữ liệu hoặc duyệt nội dung.

## Phạm vi thực sự đang chạy

- Web: `apps/web/index.html` nạp `docs/src/main.tsx`; TypeScript cũng kiểm tra `docs/src`. `apps/web/src` không phải toàn bộ ứng dụng đang chạy. Route hiện tại dành cho CMS Admin/Vendor, khách tham quan dùng Mobile.
- Mobile Expo: `package.json` dùng `expo/AppEntry`, vào `apps/mobile/App.tsx`, sử dụng `src/native` và API thật.
- Mobile Vite: `src/main.tsx` vào `src/App.tsx`, dùng dữ liệu cứng `src/data.ts`. QR mô phỏng thành công bằng timer, player mô phỏng thanh tiến trình, kích hoạt vé bằng state. Không dùng bản này làm bằng chứng tích hợp thật của Expo.

## Đối chiếu chức năng

| Hạng mục | Bằng chứng hiện có | Đánh giá |
| --- | --- | --- |
| POI và Tour | Web có quản lý/duyệt; Expo có danh sách, chi tiết, tìm kiếm, phân trang POI; cùng họ endpoint public | Tương thích mã nguồn; chưa xác nhận dữ liệu thật xuyên suốt |
| Phân quyền | Web có Admin/Vendor và giới hạn thao tác; backend có scope và review | Đã có triển khai, cần chạy lại test SQL và phiên đăng nhập thật |
| Ảnh/audio | Web có upload và preview; Expo tải ảnh và stream audio qua guest token | Có luồng triển khai, E2E upload/preview hiện chưa đạt |
| QR | Web tạo/tải mã; Expo dùng expo-camera, resolve và guest access | Khớp endpoint; chưa kiểm thử camera và QR thật xuyên suốt |
| Ngôn ngữ | Expo có vi/en/zh/ko/ja/fr và chọn ngôn ngữ từ API | Kiểm tra từ điển đạt; chưa chứng minh nội dung/audio đủ mọi ngôn ngữ |
| Bản đồ/GPS | Expo xin quyền, lấy và theo dõi vị trí, chọn POI và gọi route | Có triển khai; chưa kiểm tra GPS/provider trên thiết bị |
| Geofencing | Callback GPS trong MapPanel cập nhật vị trí; radiusMeters được khai báo/hiển thị | Chưa thấy luồng tính vùng vào/ra để kích hoạt audio, ưu tiên nhiều POI và cooldown trong Expo |
| Hàng đợi audio | DetailAudio có player, playlist, chọn bài trước/sau và tua | Chưa thấy narration engine/hàng đợi xử lý đồng thời GPS và QR; chưa xác nhận tránh chồng và audio interruption trên máy thật |
| Thống kê | CMS có tổng lượt, tổng thời lượng, biểu đồ ngày/POI; backend có play-log | Expo chưa có lời gọi gửi durationPlayedSeconds. Log kích hoạt không chứng minh thời lượng nghe thực tế |
| Tuyến ẩn danh/heatmap | Dashboard đang dùng biểu đồ ngày và POI | Chưa thấy luồng thu thập tuyến GPS ẩn danh và hiển thị heatmap hoàn chỉnh |
| Offline và đồng bộ | Có lưu phiên quyền nghe bằng SecureStore | Chưa thấy tải/lưu nội dung và audio offline hoàn chỉnh trong Expo; đây là phần kiến trúc gợi ý trong tài liệu |
| Thanh toán/gói | Backend có packages và simulate-payment; CMS tra cứu; Expo audio trả phí hướng về quét QR | Chưa có luồng mua/thanh toán thật hoàn chỉnh. Không phải yêu cầu bắt buộc của thầy theo tài liệu hiện có |
| Dịch và TTS | Web có trang automation; backend có narration jobs/provider | Cần kiểm tra provider live, sinh file, duyệt rồi phát trên Expo. Expo phát file khả dụng, không tự đọc ttsText |

## Các điểm chưa đồng nhất cần xử lý

1. Mobile có hai bản UI khác nhau: Vite demo không nối backend, Expo mới là bản native tích hợp. Cần thống nhất bản dùng để trình diễn/nghiệm thu và cập nhật README/AGENTS đang mô tả scaffold cũ.
2. Web proxy mặc định tới Gateway 8000, `start-lan.mjs` ép Expo gọi trực tiếp Content 8002. Endpoint public có thể cùng xử lý, nhưng đường truy cập khác nhau; chưa thể xác nhận hai môi trường cùng dữ liệu/cấu hình nếu chưa chạy live.
3. Web thống kê được thời lượng nhưng Expo chưa gửi sự kiện thời lượng nghe. Cần thống nhất ý nghĩa lượt kích hoạt, lượt phát và thời lượng thực nghe.
4. Có geofence engine và test trong phần Web, nhưng route Web hiện không mở trải nghiệm khách. Sự tồn tại của mã/test này không chứng minh Expo có geofencing.
5. Backend public còn endpoint simulate-payment cấp quyền sau xử lý mô phỏng. Cần giới hạn rõ ở môi trường demo trước khi sử dụng thanh toán thật.

## Kết quả chạy kiểm tra lần này

| Kiểm tra | Kết quả |
| --- | --- |
| Web TypeScript | PASS |
| Web Vitest | 27/27 PASS, 4 file |
| Web production build | PASS |
| Web ESLint | FAIL: 2 import không dùng `request`, `json` tại `apps/web/docs/src/pages/public/Catalog.tsx:4` |
| Web Playwright Chromium | 44 test: 11 PASS, 16 FAIL, 17 SKIP |
| Mobile kiểm tra phân trang | PASS, dùng TypeScript có sẵn từ node_modules Web qua NODE_PATH |
| Mobile kiểm tra từ điển/ngôn ngữ | PASS, cùng cách chạy trên |
| Mobile kiểm tra xử lý mạng | PASS, cùng cách chạy trên; đây là fetch giả lập, không phải API live |
| Mobile typecheck/build native | Chưa xác nhận: Mobile chưa có dependencies cục bộ, `tsc` không tìm thấy |
| Content service qua `scripts/test_content.py` | 76 test: 18 PASS, 3 ERROR, 55 SKIP |
| Backend live | `/health` tại localhost:8000 và :8002 không kết nối được |

Playwright lỗi tại preview văn bản/ảnh/audio, upload audio, Vendor, nhãn đăng nhập, nội dung giao dịch, automation và dashboard. Một số lỗi do test tìm nhãn/nút cũ; chưa được phép quy tất cả thành lỗi nghiệp vụ. Ví dụ test Vendor chờ nút “Thêm mới” trong khi ứng dụng chuyển sang giao diện Vendor riêng. Cần phân loại test lỗi thời và lỗi thực tế, sửa rồi chạy lại. Trace và error-context nằm tại `apps/web/.playwright-results`.

Ba ERROR backend nằm ở test route Tour và quyền nghe target: fixture thiếu `id` hoặc Mock chưa thiết lập `narration_state`, gây KeyError/TypeError. Không suy ra API thật chắc chắn gặp cùng lỗi. Các bài SQL integration đang opt-in và bị bỏ qua, không phải đã vượt qua.

Không dùng số liệu PASS trong báo cáo tích hợp cũ làm kết quả hiện tại. Thông tin cũ về số POI/Tour/public/media thiếu chưa được tái xác minh vì backend không chạy. CI Web hiện có lint và E2E nên các kết quả lỗi này cần được xử lý trước khi xác nhận CI đạt. Workflow hiện thấy tập trung Web/backend, chưa có bằng chứng build native Mobile trong lần rà soát này.

## Thứ tự đề nghị hoàn thiện

1. Hoàn thiện geofencing native: khoảng cách/bán kính, POI gần nhất/ưu tiên, debounce/cooldown, điều phối audio QR/GPS.
2. Gửi log thời lượng nghe thực tế từ Expo; thống nhất dữ liệu thống kê, bổ sung tuyến ẩn danh/heatmap nếu nghiệm thu theo yêu cầu đã ghi.
3. Sửa lint, phân loại và sửa 16 E2E lỗi cùng 3 fixture backend; bổ sung dependencies để typecheck/build Expo.
4. Chạy Auth/Content/Gateway với cùng DB; kiểm thử Web tạo/sửa → Pending → duyệt → Expo hiển thị đúng bản dịch, ảnh, thứ tự Tour và file audio. Xác minh file media thật còn thiếu hay không.
5. Kiểm tra trên điện thoại: camera, GPS, từ chối quyền, mạng yếu/mất mạng, token hết hạn, quay nền, gián đoạn audio và provider route/TTS thật.

Chỉ sau các bước này mới có bằng chứng để xác nhận hai bên đồng bộ và các chức năng cốt lõi hoạt động tốt.
