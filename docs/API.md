# Hợp đồng REST API

Base URL: `/api/v1`. Định dạng JSON thống nhất: `success`, `data`, `message`, `pagination` khi có phân trang. Lỗi không chứa stack trace. Các mutation yêu cầu header `Origin` bằng `FRONTEND_URL`.

## Public

| Endpoint | Nội dung |
| --- | --- |
| `GET /regions` | Vùng published |
| `GET /provinces?regionId=&q=&page=&limit=&lang=` | Tỉnh thành |
| `GET /provinces/:slug` | Province cùng destinations và specialties |
| `GET /destinations?provinceId=&category=&q=&page=&limit=` | Danh mục địa danh |
| `GET /destinations/:slug` | Địa danh, province/region và nearby trong bán kính 100 km |
| `GET /specialties`, `GET /specialties/:slug` | Đặc sản và nội dung liên quan |
| `GET /search?q=Huế&lang=en` | Gợi ý tỉnh, địa danh, đặc sản, lịch sử |
| `GET /discover` | Nội dung trang chủ và số đếm từ database |
| `GET /discover/random` | Một địa danh published ngẫu nhiên |
| `GET /community?destinationId=&page=&limit=` | Ảnh approved |
| `GET /comments?destinationId=&communityPostId=` | Bình luận approved; bỏ post ID để đọc thảo luận địa danh |
| `GET /media/:id` | Stream ảnh; ảnh pending/rejected yêu cầu admin |

`lang=vi|en`, mặc định `vi`. EN trống dùng VI. `limit` tối đa 100; mặc định 12. `sort=name|newest`. Danh mục public loại bản nháp, archived, soft-deleted và nội dung dưới cha chưa published.

## Đóng góp

`POST /community`, multipart/form-data:

```text
destinationId: ObjectId
guestName: tên (1–80 ký tự)
image: tệp JPEG/PNG/WebP, tối đa 8 MB
caption: tối đa 2000 ký tự
takenAt: ngày chụp (tùy chọn, không ở tương lai)
locale: vi | en
website: rỗng (honeypot)
captchaToken: nếu bật Turnstile
```

`POST /comments`, JSON:

```json
{"destinationId":"OBJECT_ID","guestName":"Linh","content":"Một góc nhìn đáng nhớ.","locale":"vi","website":""}
```

Thêm `communityPostId` để bình luận một ảnh approved thuộc cùng địa danh. `status` từ client bị từ chối; server luôn tạo pending. Trả HTTP 201 và `{id,status}`.

## Xác thực

- `POST /auth/login`: `{email,password}`; HTTP 200 + httpOnly cookie.
- `GET /auth/me`: phiên admin hiện tại.
- `POST /auth/logout`: thu hồi phiên và xóa cookie.

## CRUD quản trị

`GET/POST /admin/:entity`, `PATCH/DELETE /admin/:entity/:id`. Entity: `regions`, `provinces`, `destinations`, `specialties`. GET trả bản dịch gốc. PATCH là object các trường cần sửa, không bọc `{data}`. DELETE xóa mềm. Không cho xóa region/province khi còn bản ghi con chưa xóa.

Ví dụ tạo địa danh:

```json
{
  "provinceId": "OBJECT_ID",
  "slug": "dia-danh-moi",
  "name": {"vi": "Địa danh mới", "en": "New place"},
  "shortDescription": {"vi": "Giới thiệu ngắn", "en": "Short introduction"},
  "description": {"vi": "Nội dung đã biên tập", "en": "Edited content"},
  "history": {"summary": {"vi": "Tư liệu lịch sử", "en": "History"}, "events": []},
  "geography": {"description": {"vi": "Vị trí địa lý", "en": "Setting"}},
  "location": {"type": "Point", "coordinates": [107.58, 16.47]},
  "category": "heritage",
  "heroImage": "/api/v1/media/OBJECT_ID",
  "officialGallery": [],
  "status": "draft",
  "isSample": true
}
```

Tọa độ ví dụ chỉ minh họa payload. `category`: nature/heritage/culture/museum. `status`: draft/published/archived. Text `{vi,en}`; VI bắt buộc ở trường chính, EN tùy chọn. Timeline event: `{year,title:{vi,en},description:{vi,en},image?,source?}`.

## Moderation và media

- `GET /admin/community?status=pending|approved|rejected&page=1`
- `GET /admin/comments?status=...`
- `PATCH /admin/community/moderate` hoặc `/admin/comments/moderate`: `{ids:[...],action:"approve"|"reject"}`.
- `DELETE /admin/community/:id`, `/admin/comments/:id`: xóa mềm.
- `GET /admin/dashboard`: số liệu và hoạt động gần đây.
- `POST /admin/media`: multipart `image`; trả media và URL.
- `GET /admin/media`: phân trang media.
- `DELETE /admin/media/:id`: chỉ xóa ảnh không còn được tham chiếu.

Moderation ghi `moderatedBy` và `moderatedAt`; có thể duyệt lại/từ chối lại. File cộng đồng đã bị từ chối không public qua URL media. Nội dung trong database được hiển thị dưới dạng văn bản, không render HTML do khách gửi.
