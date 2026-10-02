import { hash } from "bcryptjs";
import { models, Admin, RateBucket } from "./models/index.ts";
import provinceSeedJson from "./data/vietnam-63-provinces-content-seed.json" with {
  type: "json",
};

type Translation = { vi: string; en: string };
type ProvinceSeed = {
  slug: string;
  status: "draft" | "published" | "archived";
  region: "mien-bac" | "mien-trung" | "mien-nam";
  name: Translation;
  shortIntro: Translation;
  overview: Translation;
  culture: Translation;
  people: Translation;
  history: Translation;
  geography: Translation;
  terrain: Translation;
  climate: Translation;
  borders: Translation;
  didYouKnow: { vi: string[]; en: string[] };
  timeline: { period: string; vi: string; en: string }[];
  longitude: number | null;
  latitude: number | null;
  areaKm2: number | null;
  historicalImage: string;
  currentImage: string;
  coverImage: string;
  officialGallery: string[];
  references: { name: string; url: string }[];
};

const provinceRows = provinceSeedJson as ProvinceSeed[];
if (
  provinceRows.length !== 63 ||
  new Set(provinceRows.map(({ slug }) => slug)).size !== 63
)
  throw new Error("The province seed must contain 63 unique slugs.");

const bi = (vi: string, en = "") => ({ vi, en });
const bay =
  "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1800&q=85";
const town =
  "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1800&q=85";
const landscape =
  "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1800&q=85";
export async function seedDatabase(
  email: string,
  password: string,
  options: { includeSampleContent?: boolean } = {},
) {
  if (password.length < 12)
    throw new Error("Seed password must be at least 12 characters");
  const existing = await Admin.exists({ email });
  if (!existing)
    await Admin.create({
      email,
      name: "Ban biên tập",
      passwordHash: await hash(password, 12),
    });
  const regionRows = [
    ["mien-bac", "Miền Bắc", "Northern Vietnam", bay],
    ["mien-trung", "Miền Trung", "Central Vietnam", town],
    ["mien-nam", "Miền Nam", "Southern Vietnam", landscape],
  ];
  const createdRegions = [];
  for (const [order, row] of regionRows.entries()) {
    const [slug, vi, en, heroImage] = row;
    let item = await models.regions.findOne({ slug });
    if (!item)
      item = await models.regions.create({
        slug,
        name: bi(vi, en),
        description: bi(
          "Khám phá các lớp cảnh quan, văn hóa và ký ức địa phương.",
          "Explore layers of landscape, culture and local memory.",
        ),
        heroImage,
        order,
        status: "published",
        isSample: true,
      });
    createdRegions.push(item);
  }
  const sampleRows = [
    {
      slug: "quang-ninh",
      name: bi("Quảng Ninh", "Quang Ninh"),
      region: 0,
      coords: [107.08, 20.95],
      hero: bay,
      overview: bi(
        "Một miền biển đảo gắn với cảnh quan đá vôi của Vịnh Hạ Long.",
        "A coastal region associated with the limestone seascapes of Hạ Long Bay.",
      ),
      history: bi(
        "Các cộng đồng ven vịnh gắn đời sống với biển qua nhiều thế hệ.",
        "Communities around the bay have lived with the sea across generations.",
      ),
      source: "https://vietnam.travel/places-to-go/northern-vietnam/ha-long",
      food: bi("Chả mực", "Squid cakes"),
      foodSlug: "cha-muc",
      sites: [
        [
          "vinh-ha-long",
          "Vịnh Hạ Long",
          "Ha Long Bay",
          107.18,
          20.91,
          "nature",
        ],
        [
          "bao-tang-quang-ninh",
          "Bảo tàng Quảng Ninh",
          "Quang Ninh Museum",
          107.103,
          20.95,
          "museum",
        ],
      ],
    },
    {
      slug: "thua-thien-hue",
      name: bi("Thừa Thiên Huế", "Thua Thien Hue"),
      region: 1,
      coords: [107.59, 16.46],
      hero: town,
      overview: bi(
        "Không gian của thành quách, nhà vườn và những truyền thống nghệ thuật bên sông Hương.",
        "A landscape of citadels, garden houses and artistic traditions beside the Perfume River.",
      ),
      history: bi(
        "Huế từng là kinh đô dưới triều Nguyễn. Các công trình cung đình còn lưu dấu một giai đoạn lịch sử quan trọng.",
        "Huế was the capital under the Nguyễn dynasty. Its court architecture preserves traces of a significant historical period.",
      ),
      source: "https://vietnam.travel/vi/places-to-go/central-vietnam/hue",
      food: bi("Bún bò Huế", "Hue beef noodle soup"),
      foodSlug: "bun-bo-hue",
      sites: [
        [
          "dai-noi-hue",
          "Đại Nội Huế",
          "Hue Imperial City",
          107.5774,
          16.4698,
          "heritage",
        ],
        [
          "chua-thien-mu",
          "Chùa Thiên Mụ",
          "Thien Mu Pagoda",
          107.5449,
          16.4535,
          "heritage",
        ],
      ],
    },
    {
      slug: "can-tho",
      name: bi("Cần Thơ", "Can Tho"),
      region: 2,
      coords: [105.747, 10.045],
      hero: landscape,
      overview: bi(
        "Một không gian văn hóa sông nước với vườn cây và nhịp sống gắn cùng những dòng sông.",
        "A river landscape of orchards and daily life shaped by waterways.",
      ),
      history: bi(
        "Bài lịch sử chuyên sâu đang chờ ban biên tập bổ sung nguồn. Dữ liệu này phục vụ kiểm thử trải nghiệm.",
        "A detailed historical article awaits referenced editorial content. This sample supports experience testing.",
      ),
      source:
        "https://vietnam.travel/things-to-do/can-tho-glimpse-river-and-garden",
      food: bi("Bánh xèo", "Crisp rice pancake"),
      foodSlug: "banh-xeo",
      sites: [
        [
          "ben-ninh-kieu",
          "Bến Ninh Kiều",
          "Ninh Kieu Wharf",
          105.789,
          10.032,
          "culture",
        ],
        [
          "cho-noi-cai-rang",
          "Chợ nổi Cái Răng",
          "Cai Rang Floating Market",
          105.746,
          10.009,
          "culture",
        ],
      ],
    },
  ];
  const regionBySlug = new Map(
    createdRegions.map((region) => [region.slug, region]),
  );
  for (const row of provinceRows) {
    const region = regionBySlug.get(row.region);
    if (!region) throw new Error(`Unknown region ${row.region}`);
    const hasCoordinates =
      Number.isFinite(row.longitude) && Number.isFinite(row.latitude);
    const historyImages = {
      ...(row.historicalImage ? { beforeImage: row.historicalImage } : {}),
      ...(row.currentImage ? { afterImage: row.currentImage } : {}),
    };
    const provinceData = {
      name: row.name,
      slug: row.slug,
      regionId: region._id,
      shortDescription: row.shortIntro,
      overview: row.overview,
      culture: row.culture,
      people: row.people,
      history: {
        summary: row.history,
        events: row.timeline.map((event, index) => ({
          year: String(index + 1).padStart(2, "0"),
          title: bi(event.period, event.period),
          description: bi(event.vi, event.en),
        })),
        ...historyImages,
      },
      geography: {
        description: row.geography,
        terrain: row.terrain,
        climate: row.climate,
        boundaries: row.borders,
        ...(row.areaKm2 == null ? {} : { areaKm2: row.areaKm2 }),
      },
      ...(hasCoordinates
        ? {
            coordinates: {
              type: "Point" as const,
              coordinates: [row.longitude!, row.latitude!],
            },
          }
        : {}),
      ...(row.coverImage ? { heroImage: row.coverImage } : {}),
      gallery: row.officialGallery,
      fact: bi(row.didYouKnow.vi.join(" • "), row.didYouKnow.en.join(" • ")),
      ...(row.references[0]?.url
        ? { factSource: row.references[0].url }
        : {}),
      sources: row.references.map((source) => ({
        title: source.name,
        url: source.url,
      })),
      status: row.status,
      isSample: false,
    };
    await models.provinces.findOneAndUpdate(
      { slug: row.slug },
      {
        $set: provinceData,
        ...(!hasCoordinates || !row.coverImage
          ? {
              $unset: {
                ...(!hasCoordinates ? { coordinates: 1 } : {}),
                ...(!row.coverImage ? { heroImage: 1 } : {}),
              },
            }
          : {}),
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }
  for (const row of options.includeSampleContent ? sampleRows : []) {
    let province = await models.provinces.findOne({ slug: row.slug });
    if (!province)
      province = await models.provinces.create({
        name: row.name,
        slug: row.slug,
        regionId: createdRegions[row.region]._id,
        shortDescription: row.overview,
        overview: row.overview,
        culture: bi(
          "Nội dung mẫu: khám phá văn hóa địa phương qua kiến trúc, sinh hoạt và ẩm thực.",
          "Sample editorial content: explore local culture through architecture, daily life and food.",
        ),
        people: bi(
          "Câu chuyện của cư dân địa phương đang được biên tập.",
          "Stories from local communities are being edited.",
        ),
        history: {
          summary: row.history,
          events: [
            {
              year: "Tư liệu / Archive",
              title: bi("Ký ức địa phương", "Local memory"),
              description: row.history,
              source: row.source,
            },
          ],
        },
        geography: {
          description: bi(
            "Tọa độ trong bộ dữ liệu mẫu là điểm định hướng gần đúng; không thể hiện địa giới.",
            "Coordinates in this sample are approximate orientation points, not administrative boundaries.",
          ),
          terrain: bi(
            "Thông tin địa hình đang được biên tập.",
            "Terrain information is being edited.",
          ),
          climate: bi(
            "Chưa bổ sung số liệu khí hậu đã xác minh.",
            "Verified climate data has not yet been added.",
          ),
        },
        coordinates: { type: "Point", coordinates: row.coords },
        heroImage: row.hero,
        gallery: [row.hero],
        status: "published",
        isSample: true,
        sources: [{ title: "Vietnam Tourism", url: row.source }],
      });
    for (const site of row.sites) {
      const [slug, vi, en, lng, lat, category] = site;
      const dest = await models.destinations.findOne({ slug });
      if (dest)
        await models.destinations.updateOne(
          { _id: dest._id },
          { $set: { provinceId: province._id } },
        );
      else
        await models.destinations.create({
          provinceId: province._id,
          slug,
          name: bi(String(vi), String(en)),
          shortDescription: row.overview,
          description: bi(
            `Hồ sơ mẫu giới thiệu ${vi}. Ảnh minh họa và tọa độ định hướng cần được biên tập xác minh trước khi xuất bản chính thức.`,
            `Sample profile for ${en}. Illustrative imagery and orientation coordinates require editorial verification before official publication.`,
          ),
          history: { summary: row.history, events: [] },
          culturalValue: bi(
            "Không gian mở để tìm hiểu mối liên hệ giữa cảnh quan và đời sống.",
            "An invitation to understand the relationship between landscape and everyday life.",
          ),
          geography: {
            description: bi(
              "Điểm trên bản đồ có tính định hướng trong bộ dữ liệu mẫu.",
              "This map point is approximate sample data.",
            ),
          },
          address: row.name,
          location: { type: "Point", coordinates: [Number(lng), Number(lat)] },
          category,
          heroImage: row.hero,
          officialGallery: [row.hero],
          status: "published",
          isSample: true,
          sources: [{ title: "Vietnam Tourism", url: row.source }],
        });
    }
    const specialty = await models.specialties.findOne({ slug: row.foodSlug });
    if (specialty)
      await models.specialties.updateOne(
        { _id: specialty._id },
        { $set: { provinceId: province._id } },
      );
    else
      await models.specialties.create({
        provinceId: province._id,
        slug: row.foodSlug,
        name: row.food,
        description: bi(
          "Hồ sơ ẩm thực mẫu để tìm hiểu một hương vị gắn với địa phương.",
          "A sample culinary profile exploring a flavour associated with the locality.",
        ),
        origin: bi(
          "Nguồn gốc chi tiết đang được biên tập và đối chiếu tư liệu.",
          "Detailed origins are being edited and checked against sources.",
        ),
        culturalStory: bi(
          "Ẩm thực là một cách tiếp cận ký ức và sinh hoạt của cộng đồng.",
          "Food offers a way into community memory and daily life.",
        ),
        characteristics: bi(
          "Mô tả thành phần sẽ được ban biên tập xác minh.",
          "Ingredient descriptions await editorial verification.",
        ),
        servingGuide: bi(
          "Bài viết cách thưởng thức đang được hoàn thiện; không có nội dung mua bán.",
          "The serving guide is being prepared; no sales information is included.",
        ),
        images: ["/images/specialty-placeholder.svg"],
        status: "published",
        isSample: true,
      });
  }
  if (!options.includeSampleContent) {
    await models.destinations.deleteMany({
      slug: {
        $in: [
          "vinh-ha-long",
          "bao-tang-quang-ninh",
          "dai-noi-hue",
          "chua-thien-mu",
          "ben-ninh-kieu",
          "cho-noi-cai-rang",
        ],
      },
      isSample: true,
    });
    await models.specialties.deleteMany({
      slug: { $in: ["cha-muc", "bun-bo-hue", "banh-xeo"] },
      isSample: true,
    });
  }
  await models.provinces.deleteOne({ slug: "hue", isSample: true });
  await Promise.all(
    [...Object.values(models), Admin, RateBucket].map((model) =>
      model.createIndexes(),
    ),
  );
  return {
    regions: await models.regions.countDocuments(),
    provinces: await models.provinces.countDocuments(),
    destinations: await models.destinations.countDocuments(),
    specialties: await models.specialties.countDocuments(),
  };
}
