Tổng hợp yêu cầu của giảng viên – Đồ án Seminar Chuyên Đề AudioTour
Dưới đây là bản tổng hợp các yêu cầu từ tài liệu và hình ảnh bạn đã cung cấp trước đó, bao gồm chức năng, kiến trúc hệ thống, công nghệ, quy trình hoạt động và yêu cầu thực hiện đồ án.
Mình phân biệt giữa yêu cầu của thầy và những giải pháp kỹ thuật được đề xuất, để bạn không nhầm phần gợi ý thành bắt buộc.
I. Thông tin và yêu cầu chung
Đề tài: Hệ thống thuyết minh tự động đa ngôn ngữ (AudioTour).
Mục tiêu là xây dựng ứng dụng hỗ trợ khách tham quan tìm hiểu các địa điểm thông qua bản đồ, vị trí GPS, mã QR và nội dung thuyết minh bằng âm thanh.
Nội dung	Yêu cầu
Nhóm thực hiện	3–4 sinh viên
Mobile	React Native
Web	React.js
Backend	Kiến trúc 3 lớp hoặc services
Quản lý mã nguồn	GitHub
CI/CD	Có cho frontend và backend
Theo dõi tiến độ	Kiểm tra tiến độ theo các mốc thực hiện
Database	Cần lưu trữ dữ liệu hệ thống; SQL Server là lựa chọn hiện tại của dự án
II. Các chức năng chính
1. Quản lý địa điểm tham quan (POI)
POI (Point of Interest) là địa điểm có nội dung thuyết minh.
- Danh sách các POI.
- Thông tin tên và mô tả địa điểm.
- Nội dung văn bản giới thiệu.
- Hình ảnh minh họa.
- Tọa độ vị trí trên bản đồ.
- Liên kết bản đồ.
- Nội dung audio hoặc kịch bản TTS.
- Cho phép quản lý và cập nhật thông tin POI.
2. Bản đồ và định vị
- Hiển thị vị trí hiện tại của người dùng.
- Hiển thị tất cả POI trên bản đồ.
- Xác định POI gần người dùng.
- Làm nổi bật POI gần nhất.
- Cho phép chọn POI để xem thông tin chi tiết.
3. Geofencing – Tự động phát hiện địa điểm
- Mỗi POI có tọa độ latitude và longitude.
- Mỗi POI có bán kính kích hoạt.
- Xác định khi người dùng đi vào hoặc đến gần vùng POI.
- Tự động kích hoạt thuyết minh phù hợp.
- Xử lý trường hợp nhiều POI gần nhau bằng độ ưu tiên.
- Có debounce/cooldown để tránh phát lặp liên tục do GPS dao động.
4. Thuyết minh bằng âm thanh
- Hỗ trợ nhiều ngôn ngữ.
- Sử dụng file audio thu sẵn hoặc Text-to-Speech (TTS).
- Phát nội dung tương ứng với POI.
- Có hàng đợi phát âm thanh.
- Không phát chồng nhiều bài thuyết minh.
- Có cơ chế dừng hoặc xử lý khi xuất hiện thông báo hoặc tác vụ âm thanh khác.
Số lượng ngôn ngữ: Trong phần yêu cầu đã cung cấp, chưa thấy thầy quy định một con số cụ thể.
5. Kích hoạt bằng mã QR
- POI có thể gắn mã QR.
- Khách tham quan quét QR để mở nội dung tương ứng.
- Có thể kích hoạt thuyết minh không phụ thuộc vào GPS.
6. Thống kê và phân tích (Analytics)
- Ghi nhận tuyến đường tham quan theo hướng ẩn danh.
- Thống kê các POI được nghe nhiều nhất.
- Thống kê thời lượng nghe trung bình.
- Thể hiện dữ liệu dưới dạng heatmap.
- Hỗ trợ phân tích hành vi tham quan từ dữ liệu thu thập được.
III. Kiến trúc hệ thống
Thầy đưa ra kiến trúc tham khảo gồm các thành phần sau:
Thành phần	Nhiệm vụ
Location Service	Nhận và cập nhật vị trí GPS
Geofencing Service	Phát hiện người dùng vào hoặc ra vùng POI
Geofence Engine	Xử lý bán kính, khoảng cách và độ ưu tiên
Narration Engine	Quyết định nội dung cần phát và quản lý trạng thái âm thanh
Offline Storage	Lưu nội dung cục bộ, có thể dùng SQLite
Content Sync	Đồng bộ dữ liệu từ server về thiết bị
UI	Hiển thị bản đồ, POI, thông tin và trình phát
Đây là kiến trúc gợi ý, có thể điều chỉnh cho phù hợp với công nghệ và tiến độ của nhóm.
IV. Quy trình hoạt động của hệ thống
1. Tải danh sách POI
Nhận thông tin địa điểm và nội dung thuyết minh
2. Cập nhật vị trí GPS
Xác định tọa độ hiện tại của khách tham quan
3. Geofence Engine xử lý
Kiểm tra khoảng cách, bán kính và mức ưu tiên POI
4. Narration Engine kiểm tra
Trạng thái phát, lịch sử phát và thời gian cooldown
5. Phát thuyết minh
Phát file audio hoặc TTS theo ngôn ngữ người dùng chọn
6. Ghi nhận lịch sử
Lưu sự kiện nghe phục vụ thống kê

V. Yêu cầu kỹ thuật và tổ chức thực hiện
- Frontend: React Native cho mobile và React.js cho web.
- Backend: Thiết kế theo kiến trúc ba lớp hoặc phân chia thành services.
- CI/CD: Có quy trình kiểm tra, build và triển khai phù hợp.
- GitHub: Quản lý mã nguồn và thể hiện tiến độ phát triển.
- Làm việc nhóm: Phân chia công việc cho 3–4 thành viên.
- Báo cáo tiến độ: Có các mốc kiểm tra quá trình thực hiện.
VI. Những gì không nên hiểu nhầm là yêu cầu bắt buộc
Các nội dung sau thuộc phương án triển khai của dự án hoặc đề xuất kỹ thuật, chưa có căn cứ xác nhận là thầy bắt buộc:
- Phải hỗ trợ đúng 3 ngôn ngữ Việt – Anh – Trung.
- Phải dùng SQL Server thay vì hệ quản trị cơ sở dữ liệu khác.
- Phải dùng FastAPI, Vite hoặc Leaflet.
- Phải tích hợp thanh toán.
- Phải có đúng một số lượng POI hoặc tour cụ thể.
- Phải triển khai đầy đủ mọi tính năng nâng cao ngay trong giai đoạn đầu.
VII. Checklist đối chiếu đồ án
Theo dõi mức độ hoàn thành
0/16



[ ] Ứng dụng React Native
[ ] Ứng dụng React.js
[ ] Backend kiến trúc 3 lớp/services
[ ] GitHub và CI/CD
[ ] Quản lý POI và nội dung
[ ] Bản đồ hiển thị vị trí và POI
[ ] Geofencing theo tọa độ và bán kính
[ ] Xử lý độ ưu tiên, debounce/cooldown
[ ] Thuyết minh đa ngôn ngữ
[ ] File audio hoặc TTS
[ ] Hàng đợi âm thanh, tránh phát chồng
[ ] Quét QR kích hoạt POI
[ ] Lưu nội dung offline và đồng bộ
[ ] Analytics lượt nghe và thời lượng
[ ] Tuyến tham quan ẩn danh và heatmap
[ ] Kiểm thử và báo cáo tiến độ
 Sao chép checklist

Kết luận: Trọng tâm đồ án của thầy là hệ thống thuyết minh tự động dựa trên vị trí GPS, geofencing, nội dung đa ngôn ngữ, audio/TTS và QR Code, kết hợp quản lý POI, bản đồ, thống kê và kiến trúc frontend/backend có CI/CD.
Đây là bản tổng hợp theo những yêu cầu đã được ghi nhận từ tài liệu bạn gửi, không phải bản chép nguyên văn từng trang.