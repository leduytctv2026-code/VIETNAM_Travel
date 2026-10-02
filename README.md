# Vietnam, Unfolded — nền tảng khám phá di sản Việt Nam

Nền tảng **phi thương mại** để khám phá vùng miền, tỉnh thành, địa danh, lịch sử, địa lý, đặc sản và những góc nhìn từ cộng đồng. Không có đặt chỗ, thanh toán, bán hàng hoặc tài khoản thành viên. Khách gửi ảnh/bình luận không cần đăng ký; admin quản lý nội dung và duyệt đóng góp.

## 1. Kiến trúc

Giữ frontend Next.js hiện có tại `src/` để tránh di chuyển không cần thiết. Backend Express độc lập nằm trong `backend/`. Frontend **không import Mongoose hoặc truy cập MongoDB**.

```text
Next.js / React / TypeScript
  → fetch wrapper src/services/api.ts
  → /api/v1 (Next.js reverse proxy)
  → Express route → controller → service → repository/model
  → MongoDB / MongoDB Atlas
```

- `backend/src/models/`: schema đa ngôn ngữ, GeoJSON, index, soft delete.
- `backend/src/services/`: nội dung, tìm kiếm, xác thực, cộng đồng, media, moderation.
- `backend/src/providers/`: `LocalMediaProvider` và `S3MediaProvider`.
- `backend/src/middleware/`: kiểm tra Origin, JWT, rate limit, lỗi tập trung.
- `src/components/`: layout, bản đồ, timeline, gallery/lightbox, search, admin.
- `src/app/`: Server Components, route public, metadata, sitemap, robots.
- `shared/domain.ts`: hợp đồng kiểu dữ liệu frontend/API.
- `backend/tests/`, `tests/frontend/`: kiểm thử tích hợp và tương tác.

## 2. Yêu cầu

Node.js 24 LTS, npm và một database MongoDB Atlas. Development không dùng Docker, Docker Compose hoặc MongoDB local. Ứng dụng chạy frontend cổng `3000`, API cổng `5000`.

## 3. Cài đặt và chạy nhanh

```sh
npm ci
copy .env.example .env
```

Tạo MongoDB Atlas cluster, database user và allowlist IP phát triển. Điền `DATABASE_URL` trong `.env`, thay `JWT_SECRET` và đặt `SEED_ADMIN_PASSWORD` tối thiểu 12 ký tự. Không dùng URI MongoDB local. Có thể chạy `npm run setup:dev` để tạo `.env` mẫu và secret ngẫu nhiên, nhưng vẫn phải thay `DATABASE_URL` bằng URI Atlas.

Sau khi Atlas sẵn sàng:

```sh
npm run seed
npm run dev
```

Truy cập `http://localhost:3000`; admin tại `/admin`. `npm run dev` chạy song song Express và Next.js. Có thể chạy riêng `npm run dev:api` và `npm run dev:web`.

## 4. Biến môi trường

Xem `.env.example`. Các biến chính:

| Biến                                       | Mục đích                                                           |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `DATABASE_URL`                             | MongoDB connection string; dùng `mongodb+srv://` cho Atlas         |
| `JWT_SECRET`                               | Chuỗi ngẫu nhiên tối thiểu 32 ký tự                                |
| `FRONTEND_URL`                             | Origin chính xác, gồm giao thức và cổng; production bắt buộc HTTPS |
| `API_INTERNAL_URL`                         | Địa chỉ Express mà Next.js có thể truy cập                         |
| `PORT`                                     | Cổng Express, mặc định 5000                                        |
| `MEDIA_PROVIDER`                           | `local` hoặc `s3`                                                  |
| `MEDIA_ROOT`                               | Thư mục ảnh riêng tư khi dùng local                                |
| `S3_BUCKET`, `S3_REGION`                   | Cấu hình object storage riêng tư                                   |
| `S3_ENDPOINT`                              | Tùy chọn cho S3-compatible storage                                 |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Tùy chọn; nên dùng IAM role ở production                           |
| `CAPTCHA_SECRET`, `CAPTCHA_SITE_KEY`       | Turnstile tùy chọn, cấu hình đồng thời                             |
| `TRUST_PROXY_HOPS`                         | Số proxy tin cậy; mặc định 0                                       |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`  | Tạo admin đầu tiên; mật khẩu tối thiểu 12 ký tự                    |

Không đưa secret vào biến có tiền tố `NEXT_PUBLIC_`. Rewrite API được tạo khi build: đặt `API_INTERNAL_URL` đúng trước khi `npm run build`.

## 5. MongoDB và dữ liệu hành chính

Các collection chính: `admins`, `regions`, `provinces`, `destinations`, `specialties`, `community_posts`, `comments`, `media`, `ratebuckets`.

Không có số lượng tỉnh/thành hoặc năm hành chính cố định trong business logic. Quan hệ vùng → tỉnh → địa danh được lưu trong database; admin có thể thêm, sửa, lưu trữ, xóa mềm. Danh mục public và số đếm lấy từ API.

Atlas cần database user với quyền phù hợp, network allowlist và TLS. Tắt tự tạo index ở runtime; seed và lệnh `npm run db:indexes` tạo các index đã khai báo. Với database cũ, kiểm tra kế hoạch migration trước khi thay index. Schema mới không tự chuyển đổi dữ liệu của bản demo Next.js API trước đây; nên dùng database mới hoặc viết migration theo dữ liệu thực tế của bạn.

## 6. Seed và tính toàn vẹn nội dung

`npm run seed` tạo ba vùng, ba hồ sơ tỉnh thành đại diện, sáu địa danh, ba đặc sản và admin đầu tiên. Lệnh **không xóa dữ liệu** và không ghi đè hồ sơ có cùng slug hoặc mật khẩu admin có cùng email.

Tất cả hồ sơ seed được gắn `isSample: true`. Ảnh mang tính minh họa, tọa độ có tính định hướng; các đoạn chưa có tư liệu ghi rõ đang biên tập. Không dùng seed như bách khoa đã kiểm chứng. Các nguồn tham khảo nằm trong từng hồ sơ. Admin cần thay ảnh có bản quyền, kiểm tra tọa độ và biên tập nội dung trước khi bỏ nhãn mẫu. Hồ sơ mẫu không được đưa vào sitemap chi tiết hoặc schema địa danh.

## 7. Xác thực và quản trị

Admin được lưu trong database với bcrypt hash. Đăng nhập cấp JWT hai giờ qua cookie `HttpOnly`, `SameSite=Strict`, `Secure` ở production. Token không được trả cho JavaScript. Logout tăng phiên bản phiên đăng nhập trên admin và thu hồi các JWT cũ của admin đó.

Dashboard có số liệu thực, hoạt động gần đây; biểu mẫu CRUD riêng VI/EN; trường lịch sử, timeline, địa lý, đặc sản và gallery chính thức; quản lý media; duyệt ảnh/bình luận theo tab pending/approved/rejected; chọn nhiều và xác nhận trước khi xóa.

## 8. Media và cộng đồng

Guest gửi tệp JPEG/PNG/WebP bằng multipart; tối đa 4 MB, tối thiểu 160 × 160 px, tối đa 24 triệu pixel. Server đối chiếu MIME, phần mở rộng và định dạng được giải mã; từ chối SVG/HTML/executable/ảnh động; tái mã hóa WebP, bỏ metadata, đặt tên UUID. Không dùng filename của khách để tạo đường dẫn.

Ảnh được lưu riêng tư. URL `/api/v1/media/:id` kiểm tra trạng thái: ảnh cộng đồng chưa được duyệt chỉ admin xem được. Gallery và comments chỉ đọc bản ghi approved; việc từ chối lại sẽ ẩn nội dung. Upload thất bại khi tạo bản ghi sẽ dọn tệp đã tạo.

Production nên dùng bucket S3 riêng tư hoặc storage S3-compatible. Backend phục vụ stream có kiểm tra quyền; không public bucket. Local provider phù hợp máy phát triển hoặc máy chủ có persistent volume. Upload ảnh không phụ thuộc S3 trong controller.

Honeypot, rate limit lưu MongoDB và abstraction Turnstile được triển khai. Khi nhiều replica, rate limit gửi ảnh/bình luận/login vẫn dùng database chung; giới hạn HTTP tổng quát trong bộ nhớ nên bổ sung ở reverse proxy.

## 9. Frontend, ngôn ngữ và khám phá

Mặc định tiếng Việt, chuyển VI/EN lưu cookie. UI và API đổi ngôn ngữ; bản EN trống dùng VI. Nội dung do khách nhập giữ nguyên ngôn ngữ gốc, không tự tạo bản dịch.

Route chính:

- `/explore`, `/province/:slug`: vùng, tỉnh, năm tab tách biệt.
- `/destinations`, `/destination/:slug`: lịch sử, bản đồ, official gallery, ảnh cộng đồng, thảo luận, địa danh gần đó.
- `/specialties`, `/specialty/:slug`: nguồn gốc, câu chuyện, đặc trưng, cách thưởng thức.
- `/map`: filter, tìm kiếm, marker clustering, fly-to, popup và liên kết chi tiết.
- `/community`: masonry gallery, upload, lightbox, bình luận ảnh.
- `/admin`: dashboard, nội dung, moderation, media.

Search overlay hỗ trợ debounce, phím mũi tên và Enter. Random discovery lấy địa danh published từ MongoDB. Timeline, before/after chỉ dùng dữ liệu được cung cấp. Motion giảm khi người dùng bật `prefers-reduced-motion`.

## 10. Kiểm thử và kiểm tra mã

```sh
npm run typecheck
npm run lint
npm run test:backend
npm run test:frontend
npm run build
```

Backend integration tests khởi tạo MongoDB riêng, kiểm tra auth, đọc dữ liệu, tìm kiếm, geospatial, upload tệp, moderation, comment, CRUD và fallback ngôn ngữ. Không xóa database phát triển. Frontend tests kiểm tra chuyển ngôn ngữ, bàn phím search, năm tab, validation và submit biểu mẫu.

Kiểm thử trình duyệt: xem `tests/e2e/` và `npm run test:e2e`. Cần backend/frontend đang chạy, dữ liệu seed và Chromium/Edge. Không chạy các bài kiểm thử tạo dữ liệu trên production.

Windows mặc định dùng Edge cài trên máy. Linux/macOS: chạy `npx playwright install chromium` trước khi kiểm thử. Có thể đặt `E2E_BROWSER=chrome` hoặc `msedge`. Test đọc tài khoản seed từ `.env`, tạo nội dung có tiền tố E2E và dọn dữ liệu kiểm thử sau khi hoàn tất. Ảnh kiểm tra bố cục nằm trong `.local/screenshots/`.

## 11. Build và production

```sh
npm run build
npm start
```

`backend/dist/` là Express đã biên dịch; `.next/` là frontend. Hai process có thể triển khai độc lập. Backend cần MongoDB sẵn sàng trước khi listen. Chưa cấu hình database hoặc kết nối thất bại được báo rõ, không âm thầm chuyển về dữ liệu giả.

## 12. Triển khai Vercel

Project hỗ trợ deploy frontend và Express API trong cùng một Vercel project. `src/pages/api/v1/[...path].ts` đóng gói Express thành Vercel Function; local vẫn dùng API riêng ở cổng 5000.

Cấu hình import project:

- Root Directory: `./`
- Framework Preset: `Next.js`
- Build Command: `npm run build`
- Output Directory: để trống (Next.js mặc định)
- Install Command: `npm ci`
- Node.js: `24.x`

Các giá trị trên cũng đã được cố định trong `vercel.json` và `package.json`. Trên Vercel cần đặt tối thiểu `DATABASE_URL` và `JWT_SECRET`. Nên đặt `FRONTEND_URL` thành HTTPS domain production chính xác; `TRUST_PROXY_HOPS` tự dùng giá trị 1 trên Vercel. Không đặt `API_INTERNAL_URL`: Next.js sẽ dùng API Function cùng domain. Nếu bật upload, đặt `MEDIA_PROVIDER=s3` cùng cấu hình S3; filesystem của Function không phải nơi lưu ảnh bền vững.

MongoDB phải có dữ liệu trước khi website chạy. Chạy `npm run seed` từ máy local với cùng `DATABASE_URL` production trước lần deploy đầu. Giới hạn upload là 4 MB để nằm dưới giới hạn payload 4.5 MB của Vercel Functions.

## 13. Triển khai không container

Development và source code không phụ thuộc Docker hoặc container runtime. Chạy hai process độc lập:

```sh
# terminal 1
npm run dev:api

# terminal 2
npm run dev:web
```

Hoặc dùng `npm run dev` để chạy đồng thời cả hai. Production dùng `npm run build` rồi `npm start`, với MongoDB Atlas có xác thực, HTTPS reverse proxy, secret manager, private object storage, backup và giám sát. Cấu hình trusted proxy chính xác và giới hạn upload ở reverse proxy.

## 14. API documentation

OpenAPI: `http://localhost:5000/api/v1/openapi.json`. Có thể import vào Swagger UI, Postman hoặc Insomnia. Hướng dẫn và payload CRUD: [docs/API.md](docs/API.md).

Response thống nhất: `{ success, data, message, pagination? }`. Query public hỗ trợ `lang`, `page`, `limit`, `q`, filter và sort. Admin nhận bản dịch đầy đủ `{vi,en}` để biên tập.

## 15. Giới hạn triển khai cần lưu ý

- Bộ seed chỉ là nội dung đại diện, chưa phải dữ liệu đầy đủ toàn quốc.
- Lựa chọn tham chiếu và bundle chi tiết giới hạn 100 bản ghi; danh mục và gallery có pagination. Khi số lượng lớn, mở rộng selector bằng tìm kiếm server và tải thêm.
- Không có tài khoản khách, social graph, payment hoặc booking.
- Bảo đảm quyền dùng ảnh, kiểm chứng sử liệu, kiểm thử trợ năng thực tế và vận hành backup là công việc trước khi công bố rộng rãi.
- Triển khai S3/Atlas thật cần thông tin hạ tầng của bạn; adapter và cấu hình đã có, nhưng không tự tạo tài nguyên cloud hoặc sử dụng tài khoản ngoài.
