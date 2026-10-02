// @vitest-environment jsdom
import React from "react";
import {
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import {
  LanguageProvider,
  LanguageSwitcher,
  useLanguage,
} from "../../src/components/LanguageProvider";
import SearchOverlay from "../../src/components/search/SearchOverlay";
import ProvinceDetail from "../../src/components/ProvinceDetail";
import HeroSlider from "../../src/components/HeroSlider";
import UploadModal from "../../src/components/community/UploadModal";
import Discussion from "../../src/components/community/Discussion";
import {
  UserAuthProvider,
  useUserAuth,
} from "../../src/components/auth/UserAuthProvider";
import { api, request } from "../../src/services/api";
import type { Content, ProvinceBundle, UserProfile } from "../../shared/domain";
const routing = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => routing,
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="map">Map</div>,
}));
vi.mock("../../src/services/api", () => ({ api: vi.fn(), request: vi.fn() }));
vi.mock("../../src/components/community/Captcha", () => ({
  default: () => null,
}));
const mockedApi = vi.mocked(api);
const mockedRequest = vi.mocked(request);
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: true,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  } as unknown as typeof IntersectionObserver;
});
beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.mockResolvedValue([]);
  mockedRequest.mockResolvedValue({
    success: true,
    data: [],
    message: "",
    pagination: { page: 1, limit: 12, total: 0, pages: 0 },
  });
  window.history.replaceState(null, "", "/");
});
afterEach(cleanup);
const signedInUser: UserProfile = {
  id: "b".repeat(24),
  email: "linh@example.com",
  name: "Linh",
  avatarUrl: "",
  bio: "",
  location: "",
  locale: "vi",
};
function wrap(
  children: React.ReactNode,
  user: UserProfile | null = signedInUser,
) {
  return render(
    <LanguageProvider initialLocale="vi">
      <UserAuthProvider initialUser={user}>{children}</UserAuthProvider>
    </LanguageProvider>,
  );
}
const destination = {
  _id: "a".repeat(24),
  slug: "sample",
  name: "Địa danh mẫu",
  status: "published",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
} as Content;
describe("public frontend workflows", () => {
  it("uses all supplied province records as an interactive Hero carousel", async () => {
    const provinces = ["An Giang", "Hà Nội", "Quảng Ninh"].map(
      (name, index) =>
        ({
          _id: String(index + 1).repeat(24),
          slug: ["an-giang", "ha-noi", "quang-ninh"][index],
          name,
          heroImage: `/images/region-${index + 1}.jpg`,
          status: "published",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        }) as Content,
    );
    wrap(<HeroSlider provinces={provinces} />);

    const cards = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".hero-card"),
    );
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveAttribute("aria-label", "Hiển thị An Giang");
    expect(cards[0]).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".slider-controls")).not.toBeInTheDocument();
    expect(document.querySelector(".hero-caption")).toHaveAttribute(
      "href",
      "/province/an-giang",
    );

    fireEvent.click(cards[1]);
    expect(cards[1]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute(
      "aria-label",
      "Hà Nội",
    );
  });

  it("links the active Hero item to its province profile", () => {
    const province = {
      ...destination,
      slug: "an-giang",
      name: "An Giang",
      heroImage: "/images/an-giang.jpg",
    } as Content;
    wrap(<HeroSlider provinces={[province]} />);

    const cards = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".hero-card"),
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute("aria-label", "Hiển thị An Giang");
    expect(document.querySelector(".slider-controls")).not.toBeInTheDocument();
    expect(document.querySelector(".hero-caption")).toHaveAttribute(
      "href",
      "/province/an-giang",
    );
  });

  it("defaults to Vietnamese and switches UI and saved locale to English", async () => {
    function Probe() {
      const { t } = useLanguage();
      return (
        <>
          <LanguageSwitcher />
          <p>{t("Xin chào", "Hello")}</p>
        </>
      );
    }
    wrap(<Probe />);
    expect(screen.getByText("Xin chào")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(document.cookie).toContain("atlas_locale=en");
    expect(routing.refresh).toHaveBeenCalled();
  });
  it("debounces search and opens the selected result with arrow/Enter navigation", async () => {
    mockedApi.mockResolvedValue([
      {
        title: "Huế",
        excerpt: "Di sản",
        href: "/province/hue",
        kind: "provinces",
      },
    ]);
    const close = vi.fn();
    wrap(<SearchOverlay onClose={close} />);
    await userEvent.type(screen.getByRole("combobox"), "Huế");
    await screen.findByRole("option");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(routing.push).toHaveBeenCalledWith("/province/hue");
    expect(close).toHaveBeenCalled();
    expect(mockedApi).toHaveBeenCalledWith(
      expect.stringContaining("q="),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
      "vi",
    );
  });
  it("keeps all five province sections separate and supports keyboard tabs", async () => {
    const data: ProvinceBundle = {
      province: {
        ...destination,
        name: "Tỉnh mẫu",
        overview: "Nội dung tổng quan riêng",
        history: { summary: "Lịch sử riêng biệt", events: [] },
        geography: { description: "Địa lý riêng biệt" },
        coordinates: { type: "Point", coordinates: [108, 16] },
      },
      destinations: [],
      specialties: [],
    };
    wrap(<ProvinceDetail data={data} />);
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByText("Nội dung tổng quan riêng")).toBeInTheDocument();
    expect(screen.queryByText("Lịch sử riêng biệt")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Lịch sử/ }));
    expect(screen.getByText("Lịch sử riêng biệt")).toBeInTheDocument();
    expect(
      screen.queryByText("Nội dung tổng quan riêng"),
    ).not.toBeInTheDocument();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText("Địa lý riêng biệt")).toBeInTheDocument();
    expect(screen.queryByText("Lịch sử riêng biệt")).not.toBeInTheDocument();
  });
  it("validates an empty upload form", async () => {
    wrap(<UploadModal destination={destination} onClose={vi.fn()} />);
    await userEvent.click(
      screen.getByRole("button", { name: /Gửi để xét duyệt/ }),
    );
    expect(screen.getByText("Chọn một ảnh.")).toBeInTheDocument();
    expect(mockedApi).not.toHaveBeenCalled();
  });
  it("submits a file as multipart and shows the pending-review receipt", async () => {
    mockedApi.mockResolvedValue({ id: "pending-id", status: "pending" });
    wrap(<UploadModal destination={destination} onClose={vi.fn()} />);
    const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
    await userEvent.upload(
      input,
      new File(["test-image"], "photo.png", { type: "image/png" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Gửi để xét duyệt/ }),
    );
    expect(
      await screen.findByText("Cảm ơn góc nhìn của bạn."),
    ).toBeInTheDocument();
    const call = mockedApi.mock.calls[0];
    expect(call[0]).toBe("/community");
    const form = call[1]?.body as FormData;
    expect(form.get("destinationId")).toBe(destination._id);
    expect(form.get("image")).toBeInstanceOf(File);
    expect(form.get("locale")).toBe("vi");
  });
  it("submits signed-in comments for review without displaying them as approved", async () => {
    mockedApi.mockResolvedValue({ status: "pending" });
    wrap(<Discussion destinationId={destination._id} />);
    await userEvent.type(
      screen.getByRole("textbox", { name: /Bình luận/ }),
      "Một góc nhìn thật đẹp.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Gửi bình luận" }),
    );
    expect(
      await screen.findByText("Cảm ơn bạn. Bình luận đang chờ duyệt."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(
        "/comments",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Một góc nhìn thật đẹp."),
        }),
        "vi",
      ),
    );
    expect(document.querySelectorAll("article.comment")).toHaveLength(0);
  });
  it("shows a sign-in call to action instead of an anonymous comment form", async () => {
    wrap(<Discussion destinationId={destination._id} />, null);
    expect(
      await screen.findByRole("button", { name: /Đăng nhập để bình luận/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Bình luận/ })).toBeNull();
  });
  it("shows branded icons for the enabled social sign-in providers", async () => {
    mockedApi.mockResolvedValue({ google: true, facebook: true });
    function SignInTrigger() {
      const { openSignIn } = useUserAuth();
      return <button onClick={() => openSignIn()}>Open sign-in</button>;
    }
    wrap(<SignInTrigger />, null);
    await userEvent.click(screen.getByRole("button", { name: "Open sign-in" }));
    const google = await screen.findByRole("link", {
      name: "Tiếp tục với Google",
    });
    const facebook = screen.getByRole("link", {
      name: "Tiếp tục với Facebook",
    });
    expect(google.querySelector(".auth-provider-icon")).toBeInTheDocument();
    expect(facebook.querySelector(".auth-provider-icon")).toBeInTheDocument();
  });
  it("offers registration and password recovery while keeping disabled provider logos visible", async () => {
    mockedApi.mockImplementation(async (path) => {
      if (path === "/auth/providers")
        return { google: false, facebook: false } as never;
      return [] as never;
    });
    function SignInTrigger() {
      const { openSignIn } = useUserAuth();
      return <button onClick={() => openSignIn()}>Open account</button>;
    }
    wrap(<SignInTrigger />, null);
    await userEvent.click(screen.getByRole("button", { name: "Open account" }));
    await screen.findByRole("tab", { name: "Đăng ký" });

    const google = screen.getByRole("button", { name: /Google/ });
    const facebook = screen.getByRole("button", { name: /Facebook/ });
    expect(google).toBeDisabled();
    expect(facebook).toBeDisabled();
    expect(google.querySelector(".auth-provider-icon")).toBeInTheDocument();
    expect(facebook.querySelector(".auth-provider-icon")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Đăng ký" }));
    expect(screen.getByText("Tạo tài khoản.")).toBeInTheDocument();
    expect(screen.getByLabelText("Tên hiển thị")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tạo tài khoản" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Đăng nhập" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Quên mật khẩu?" }),
    );
    expect(screen.getByText("Tìm lại mật khẩu.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Gửi hướng dẫn" }),
    ).toBeInTheDocument();
  });
});
