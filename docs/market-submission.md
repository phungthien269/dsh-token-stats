# Đưa dsh-token-stats lên Plugin Market

Tài liệu này dành cho **chủ plugin** (cần tài khoản GitHub + npm cá nhân — agent không tự tạo tài khoản). Sau khi hoàn tất, plugin sẽ hiện trong **Settings → Plugin Market** của mọi người dùng, cài một cú bấm.

## Bước 1 — Đưa mã nguồn lên GitHub

1. Tạo repo mới trên GitHub, ví dụ `your-account/dsh-token-stats` (public).
2. Đổi chỗ giữ chỗ `phungthien269` trong `package.json` (repository / homepage / bugs) và trong README nếu muốn.
3. Push toàn bộ thư mục plugin:

```sh
cd dsh-token-stats
git init && git add -A && git commit -m "dsh-token-stats 0.2.0"
git remote add origin https://github.com/phungthien269/dsh-token-stats.git
git push -u origin main
```

## Bước 2 — Đăng lên npm

```sh
npm whoami            # chưa đăng nhập thì chạy: npm login
cd dsh-token-stats
npm publish           # lần đầu; lần sau bump version rồi publish lại
```

Market ưu tiên cài từ npm đã xác minh qua repo, nên Bước 1 + 2 là đường nhanh nhất.

## Bước 3 — Đề cử vào danh mục awesome-dsh-plugin

Market KHÔNG lấy danh sách từ repo market, mà từ danh mục cộng đồng
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin).
Tạo PR **thêm 1 entry** theo đúng định dạng các entry hiện có trong danh mục
(mở file danh mục trong repo để copy khuôn). Bản nháp nội dung:

- **Name:** dsh-token-stats
- **npm:** `dsh-token-stats`
- **Description (EN):** Token usage dashboard for the DeepSeek Harness web GUI — today/week/month totals, per-model breakdown, stacked 30-day chart, 4-language UI (vi/en/zh/ja). Read-only over the Wallet ledger.
- **Description (ZH):** DeepSeek Harness Web GUI 的 Token 用量仪表盘 — 今日/本周/本月/累计汇总、按模型明细、堆叠柱状图，界面支持中/英/越/日。只读 Wallet 账本。
- **Category:** Analytics / Monitoring (hoặc mục tương đương trong danh mục)
- **Repository:** https://github.com/phungthien269/dsh-token-stats
- **Keywords:** token-usage, dashboard, wallet, i18n

PR được duyệt → site [awesome-dsh-plugin.com](https://awesome-dsh-plugin.com) và Plugin Market tự cập nhật, thường trong vòng 1 ngày.

## Bước 4 — Bảo trì

- Sửa code → `npm version patch|minor` → `npm publish`; người dùng bấm Update trong Market.
- Có thể thêm ảnh chụp màn hình vào README (market tự trích từ README khi mở dialog cài đặt; ảnh phải nằm trên GitHub).

## Kiểm tra trước khi publish

```sh
npm pack --dry-run    # xem đúng các file sẽ đăng: index.js, lib/client.js, cordis.patch.yml, README, LICENSE, CHANGELOG
node --check index.js && node --check lib/client.js
node --test test/
```
