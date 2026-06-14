# Phân tích Kiến trúc Hệ thống & Luồng Nghiệp Vụ Dự Án

Tài liệu này tổng hợp cấu trúc mã nguồn, các luồng nghiệp vụ chính/phụ và đánh giá chi tiết dự án **ManagerHourse_BE** (Hệ thống quản lý giải đua ngựa & đặt cược).

---

## 🚀 1. Luồng Nghiệp Vụ Chính (Main Workflows)

### 👤 Luồng Đăng ký / Đăng nhập & Xác thực (Auth & Users Flow)
* **API Register & Login** ([authRoutes.js](file:///e:/wdp/src/routes/authRoutes.js)): Đăng ký công khai mặc định luôn là tài khoản Spectator (người xem).
* **Tạo Tài khoản Đặc quyền (Admin-only)** ([adminUserRoutes.js](file:///e:/wdp/src/routes/adminUserRoutes.js)): Admin tạo tài khoản cho các vai trò đặc biệt: `OWNER` (chủ ngựa), `JOCKEY` (nài ngựa), và `REFEREE` (trọng tài).
* **Quản lý phiên đăng nhập**: Sử dụng JWT Access Token & Refresh Token.

### 🏆 Luồng Quản lý Giải đấu & Trận đua (Tournament & Race Management Flow)
* **Admin Khởi tạo giải đấu/trận đua** ([adminTournamentRoutes.js](file:///e:/wdp/src/routes/adminTournamentRoutes.js) & [adminRaceRoutes.js](file:///e:/wdp/src/routes/adminRaceRoutes.js)): Khởi tạo các giải đấu (`Tournament`) và lập lịch các trận đua (`Race`) tương ứng.
* **Đăng ký tham gia giải đua**:
  - `OWNER` gửi đăng ký tham gia ngựa của mình cho trận đấu.
  - `OWNER` gửi lời mời (`Invitation`) mời `JOCKEY` (nài ngựa) tham gia điều khiển ngựa.
  - `JOCKEY` chấp nhận/từ chối lời mời ([jockeyRoutes.js](file:///e:/wdp/src/routes/jockeyRoutes.js)).
  - Admin phê duyệt đăng ký tham gia trận đua.

### 🏁 Luồng Điều hành Trận đua & Ghi nhận kết quả (Race Operations Flow)
* **Trọng tài điều hành trận đua** ([refereeRoutes.js](file:///e:/wdp/src/routes/refereeRoutes.js)):
  - Cập nhật trạng thái trận đấu (START, COMPLETE).
  - Ghi nhận vi phạm (`Violation`) của nài ngựa hoặc ngựa trong trận đấu.
  - Ghi nhận và xuất bản kết quả thứ hạng (`Result` và `RaceResult`) sau khi trận đấu hoàn tất.

### 🎲 Luồng Đặt cược / Dự đoán (Prediction & Betting Flow)
* **Spectator Đặt cược**: Dùng số dư điểm ảo khởi tạo sẵn (`10,000,000` điểm ảo) để đặt cược cho ngựa dự kiến giành chiến thắng (vị trí số 1) trong trận đấu. Số điểm cược sẽ được trừ trực tiếp vào tài khoản.
* **Tự động khôi phục số dư**: Hệ thống tự động phát hiện nếu điểm của Spectator xuống dưới `100,000` điểm và đã qua 3 ngày kể từ lần hồi điểm trước, tài khoản sẽ tự động được đặt lại số dư mặc định là `10,000,000` điểm khi đăng nhập hoặc thực hiện bất kỳ hành động nào.
* **Quyết toán Kết quả & Trả thưởng**: Admin đóng cổng cược (`close`) và thực hiện quyết toán thưởng (`settle`). Người đoán đúng sẽ nhận lại tiền thưởng tương đương `betAmount * 1.8` điểm ảo được cộng trực tiếp vào số dư tài khoản.

---

## 🛠️ 2. Luồng Nghiệp Vụ Phụ (Secondary Workflows)

* **Thông báo (Notifications)** ([predictionRoutes.js](file:///e:/wdp/src/routes/predictionRoutes.js)): Gửi thông báo đến Spectator khi có kết quả thắng/thua của cược đã đặt.
* **Live Streaming Simulation** ([streamRoutes.js](file:///e:/wdp/src/routes/streamRoutes.js)): Tích hợp Mux Video để tạo/quản lý live stream trận đấu ngựa ảo, mô phỏng trực tiếp giải đua.
* **Hồ sơ cá nhân & Đổi mật khẩu** ([authRoutes.js](file:///e:/wdp/src/routes/authRoutes.js)): Cho phép người dùng cập nhật thông tin cá nhân và thay đổi mật khẩu định kỳ.
