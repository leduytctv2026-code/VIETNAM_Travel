"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Camera, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import type {
  CommunityPost,
  Content,
  Pagination,
} from "../../../shared/domain";
import { request } from "@/services/api";
import { useLanguage } from "../LanguageProvider";
import Photo from "../ui/Photo";
import UploadModal from "./UploadModal";
import Discussion from "./Discussion";
import { related } from "@/lib/content";
import { useUserAuth } from "@/components/auth/UserAuthProvider";
export default function CommunityGallery({
  destination,
  compact = false,
}: {
  destination?: Content;
  compact?: boolean;
}) {
  const { t, locale, content } = useLanguage();
  const { user, ready, openSignIn } = useUserAuth();
  const [items, setItems] = useState<CommunityPost[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>();
  const [state, setState] = useState("loading");
  const [upload, setUpload] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [destination?._id, locale]);
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    request<CommunityPost[]>(
      `/community?limit=${compact ? 6 : 12}&page=${page}${destination ? `&destinationId=${destination._id}` : ""}`,
      { signal: controller.signal },
      locale,
    )
      .then((result) => {
        setItems((prev) =>
          page === 1 ? result.data : [...prev, ...result.data],
        );
        setPagination(result.pagination);
        setState("done");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [destination?._id, locale, page, compact]);
  return (
    <div className="community-collection">
      <div className="gallery-actions">
        <p>
          {t(
            "Những góc nhìn được cộng đồng chia sẻ và ban biên tập duyệt.",
            "Perspectives shared by the community and reviewed by our editors.",
          )}
        </p>
        <button
          className="green-button"
          disabled={!ready}
          onClick={() => {
            if (!user)
              return openSignIn(
                t(
                  "Đăng nhập để chia sẻ hình ảnh của bạn.",
                  "Sign in to share your photograph.",
                ),
              );
            setUpload(true);
          }}
        >
          {t("Chia sẻ hình ảnh", "Share a photograph")}
          <Plus size={16} />
        </button>
      </div>
      {state === "loading" && !items.length ? (
        <div
          className="skeleton-grid place-grid"
          aria-label={t("Đang tải ảnh", "Loading photographs")}
        >
          {[1, 2, 3].map((x) => (
            <div key={x} />
          ))}
        </div>
      ) : state === "error" ? (
        <p role="alert">
          {t(
            "Chưa thể tải những khoảnh khắc. Vui lòng thử lại.",
            "Unable to load the photographs. Please try again.",
          )}
        </p>
      ) : !items.length ? (
        <div className="gallery-empty">
          <Camera size={35} strokeWidth={1} />
          <h3>
            {t(
              "Chưa có khoảnh khắc nào được sẻ chia.",
              "No moments shared here yet.",
            )}
          </h3>
          <p>
            {t(
              "Hãy trở thành người đầu tiên chia sẻ góc nhìn về nơi này.",
              "Be the first to share a perspective of this place.",
            )}
          </p>
        </div>
      ) : (
        <div className="masonry-gallery">
          {items.map((post, i) => (
            <button
              className="community-image"
              key={post._id}
              onClick={() => setSelected(i)}
              aria-label={`${t("Mở ảnh của", "Open photograph by")} ${post.guestName}`}
            >
              <Photo
                src={post.image}
                alt={
                  content(post.caption) ||
                  t("Ảnh cộng đồng", "Community photograph")
                }
              />
              <span>
                <strong>{post.guestName}</strong>
                <small>{content(related(post.destinationId)?.name)}</small>
                <p>{content(post.caption)}</p>
              </span>
            </button>
          ))}
        </div>
      )}
      {!compact && page < (pagination?.pages || 1) && (
        <button
          className="text-link"
          disabled={state === "loading"}
          onClick={() => setPage((p) => p + 1)}
        >
          {t("Xem thêm khoảnh khắc", "More moments")} ↓
        </button>
      )}
      {upload && (
        <UploadModal
          destination={destination}
          onClose={() => setUpload(false)}
        />
      )}
      {selected !== null && (
        <Lightbox
          posts={items}
          index={selected}
          onIndex={setSelected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
function Lightbox({
  posts,
  index,
  onIndex,
  onClose,
}: {
  posts: CommunityPost[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const { t, locale, content } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const startX = useRef(0);
  const post = posts[index];
  const destination = related(post.destinationId);
  const id = destination?._id || String(post.destinationId);
  function move(step: number) {
    onIndex((index + step + posts.length) % posts.length);
  }
  useEffect(() => {
    ref.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="community-lightbox"
      aria-label={t(
        "Ảnh cộng đồng và thảo luận",
        "Community photograph and discussion",
      )}
      onCancel={onClose}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("input,textarea,select")) return;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          move(-1);
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          move(1);
        }
      }}
    >
      <button
        className="detail-close icon-button"
        onClick={onClose}
        aria-label={t("Đóng ảnh", "Close photograph")}
      >
        <X />
      </button>
      <div
        className="lightbox-image"
        onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const distance = e.changedTouches[0].clientX - startX.current;
          if (Math.abs(distance) > 65) move(distance > 0 ? -1 : 1);
        }}
      >
        <Photo
          src={post.image}
          alt={
            content(post.caption) || t("Ảnh cộng đồng", "Community photograph")
          }
        />
        <div className="lightbox-controls">
          <button
            aria-label={t("Ảnh trước", "Previous image")}
            onClick={() => move(-1)}
          >
            <ChevronLeft />
          </button>
          <span>
            {index + 1} / {posts.length}
          </span>
          <button
            aria-label={t("Ảnh sau", "Next image")}
            onClick={() => move(1)}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="lightbox-copy">
        <h3>{post.guestName}</h3>
        {destination && (
          <Link className="text-link" href={`/destination/${destination.slug}`}>
            {content(destination.name)} ↗
          </Link>
        )}
        {post.takenAt && (
          <p>
            {t("Ngày chụp", "Taken")}:{" "}
            {new Date(post.takenAt).toLocaleDateString(
              locale === "vi" ? "vi-VN" : "en-GB",
            )}
          </p>
        )}
        <p>{content(post.caption)}</p>
        <Discussion
          key={post._id}
          destinationId={id}
          communityPostId={post._id}
        />
      </div>
    </dialog>
  );
}
