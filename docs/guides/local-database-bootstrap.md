# Cài database demo local

Mỗi máy chạy một SQL Server database riêng tên `AudioTourVinhKhanh`. Bộ seed hiện có 12 POI ẩm thực tại TP.HCM, 3 Tour và 12 tài khoản Chủ sạp (mỗi tài khoản gắn một POI). Mỗi POI có ảnh địa điểm `Highlight` và ảnh món/đồ uống `Menu`; nguồn, tác giả, giấy phép và attribution của 24 ảnh nằm trong `data/vinh-khanh-demo/image-rights.csv`. Một số ảnh menu là ảnh đại diện có ghi chú, không xác nhận món đang được quán bán. Gói thanh toán demo là 100.000 VND/60 phút. Bản dịch và audio để trống.

Dữ liệu và media nằm trên từng máy, không đồng bộ tự động. Database cũ `VinhHyAudioTourDB` chỉ để tham khảo; script không đọc, ghi hay xóa database đó.

## Yêu cầu

- SQL Server Developer hoặc Express đang chạy và cho phép kết nối TCP.
- Python backend dependencies được cài trong môi trường dự án.
- Cấu hình `.env` ở root repo với `SQLSERVER_HOST`, `SQLSERVER_PORT`, `SQLSERVER_DATABASE=AudioTourVinhKhanh`, `SQLSERVER_USE_WINDOWS_AUTH` và `SQLSERVER_ODBC_DRIVER` (hoặc SQL login/password).
- `MEDIA_ROOT=./services/content-service` để media được chép vào đúng backend đang phục vụ ảnh.

## Tạo mới database

Từ root repo, chạy trong Python environment đã cài backend requirements:

```powershell
python scripts/initialize_local_database.py
```

Chỉ khi muốn xóa và tạo lại database demo `AudioTourVinhKhanh` mới dùng:

```powershell
python scripts/initialize_local_database.py --reset
```

`--reset` xóa database demo có tên trên trước khi tái tạo; kiểm tra tên database trong `.env` và dữ liệu cần giữ trước khi chạy. Không dùng lệnh này cho database production hoặc database legacy.

Để áp dụng bộ POI/Tour/ảnh lên database demo đã seed sẵn mà không reset tài khoản:

```powershell
python scripts/update_vinh_khanh_demo_content.py
```

Lệnh cập nhật cần tìm thấy đủ mã POI và Tour hiện có trong seed. Nó thay ảnh active của các POI trong demo, chép lại media local, cập nhật bản ghi tiếng Việt và Tour; không tạo bản dịch khác hoặc audio.

## Tài khoản demo

Mật khẩu tất cả tài khoản demo là `123456`. Tên đăng nhập admin và Chủ sạp được in ra sau khi seed thành công. Chỉ dùng các tài khoản này trong database local demo.

Giữ `data/vinh-khanh-demo/image-rights.csv` cùng bộ ảnh khi chia sẻ dữ liệu để không mất thông tin giấy phép và attribution.
