export type Locale = "vi" | "en";
export type Translation = { vi: string; en?: string };
export type Text = string | Translation;
export type Point = { type: "Point"; coordinates: [number, number] };
export type HistoryEvent = {
  year: string;
  title: Text;
  description: Text;
  image?: string;
  source?: string;
};
export type Source = { title: string; url: string };
export type Content = {
  _id: string;
  slug: string;
  name: Text;
  description?: Text;
  shortDescription?: Text;
  overview?: Text;
  culture?: Text;
  people?: Text;
  culturalValue?: Text;
  origin?: Text;
  culturalStory?: Text;
  characteristics?: Text;
  servingGuide?: Text;
  address?: Text;
  history?: {
    summary: Text;
    events: HistoryEvent[];
    beforeImage?: string;
    afterImage?: string;
  };
  geography?: {
    description: Text;
    terrain?: Text;
    climate?: Text;
    boundaries?: Text;
    areaKm2?: number;
  };
  location?: Point;
  coordinates?: Point;
  heroImage?: string;
  images?: string[];
  gallery?: string[];
  officialGallery?: string[];
  regionId?: Content | string;
  provinceId?: Content | string;
  category?: string;
  status: string;
  isSample?: boolean;
  sources?: Source[];
  order?: number;
  seo?: { title?: Text; description?: Text };
  createdAt: string;
  updatedAt: string;
  distanceKm?: number;
  fact?: Text;
  factSource?: string;
};
export type CommunityPost = {
  _id: string;
  destinationId: Content | string;
  authorId?: string;
  guestName: string;
  caption: Text;
  image: string;
  takenAt?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  moderatedAt?: string;
};
export type Comment = {
  _id: string;
  destinationId: string;
  communityPostId?: string;
  authorId?: string;
  guestName: string;
  content: Text;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};
export type UserProfile = {
  id: string;
  email?: string;
  name: string;
  avatarUrl: string;
  bio: string;
  location: string;
  locale: Locale;
};
export type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};
export type Envelope<T> = {
  success: boolean;
  data: T;
  message: string;
  pagination?: Pagination;
};
export type SearchHit = {
  title: string;
  excerpt: string;
  href: string;
  kind: "provinces" | "destinations" | "specialties" | "history";
};
export type ProvinceBundle = {
  province: Content;
  destinations: Content[];
  specialties: Content[];
};
export type DestinationBundle = { destination: Content; nearby: Content[] };
export type HomeBundle = {
  regions: Content[];
  provinces: Content[];
  destinations: Content[];
  specialties: Content[];
  counts: { provinces: number; destinations: number; specialties: number };
  facts: Content[];
};
