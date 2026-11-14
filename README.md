# 🎲 Yatzy Master - Game Cờ Xúc Xắc 1 & 2 Người Chơi (Python Webapp)

Webapp chơi game cờ xúc xắc **Yatzy** (Yahtzee) trực tiếp trên trình duyệt bằng **Python (Flask)**, hỗ trợ cả **Chơi đơn**, **2 Người cùng máy (Pass & Play)** và **2 Người Online qua phòng**.

---

## 🌟 Chế độ chơi đa dạng

1. 👤 **Chơi 1 Người (Solo)**: Luyện tập, tự săn điểm kỷ lục cá nhân.
2. 👥 **2 Người Cùng Máy (Pass & Play)**: 2 người ngồi cạnh nhau chơi luân phiên lượt trên cùng một màn hình máy tính hoặc điện thoại/iPad. Bảng điểm 2 cột so kè điểm số trực tiếp.
3. 🌐 **2 Người Online (Qua Mã Phòng)**: 
   - Người 1 bấm **Tạo phòng**, nhận mã phòng (VD: `YTZ42`) hoặc bấm sao chép link mời bạn bè.
   - Người 2 mở điện thoại / máy tính khác, bấm vào link hoặc nhập mã phòng để vào bàn đấu.
   - Trạng thái xúc xắc, điểm số và đổi lượt được đồng bộ tự động theo thời gian thực!

---

## 🚀 Hướng dẫn chạy thử ở máy tính (Localhost)

Mở PowerShell tại thư mục này và gõ:

```powershell
python app.py
```
Sau đó mở trình duyệt truy cập: **`http://localhost:5000`**

---

## 🌐 Hướng dẫn Deploy Public lên Internet (Miễn phí 100%)

### Cách 1: Deploy lên Render.com (Khuyên dùng)
1. **Đưa mã nguồn lên GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Yatzy 2 players multiplayer"
   git branch -M main
   git remote add origin https://github.com/<tai-khoan-github>/<ten-repo>.git
   git push -u origin main
   ```
2. Đăng nhập [Render.com](https://render.com) bằng tài khoản GitHub.
3. Bấm **New +** -> **Web Service** -> Chọn repository vừa tạo.
4. Cấu hình các thông số:
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn -w 1 --threads 8 app:app`
   - **Instance Type:** `Free`
5. Bấm **Create Web Service**. Sau 1-2 phút bạn sẽ có link HTTPS công khai (ví dụ `https://yatzy-master.onrender.com`) để cùng bạn bè chơi online.

---

## 📜 Cấu trúc thư mục

```text
BOARGAME/
├── app.py                 # Backend Flask: Engine tính điểm, quản lý phòng & lượt chơi 2 người
├── requirements.txt       # flask, gunicorn
├── Procfile               # Khai báo server gunicorn cho Render/Railway
├── Dockerfile             # Dành cho Docker / Hugging Face Spaces
├── templates/
│   └── index.html         # Bàn cờ, bảng điểm 2 người, modal chọn chế độ & phòng đấu
└── static/
    ├── style.css          # Giao diện responsive, màu sắc phân biệt P1 / P2
    └── script.js          # Hoạt ảnh xúc xắc, âm thanh Web Audio, đồng bộ real-time
```
