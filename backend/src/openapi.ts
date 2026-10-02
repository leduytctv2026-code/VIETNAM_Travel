const ok = {
  description: "Unified JSON response",
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Envelope" } },
  },
};
const lang = {
  name: "lang",
  in: "query",
  schema: { type: "string", enum: ["vi", "en"], default: "vi" },
};
const page = {
  name: "page",
  in: "query",
  schema: { type: "integer", minimum: 1, default: 1 },
};
const limit = {
  name: "limit",
  in: "query",
  schema: { type: "integer", minimum: 1, maximum: 100, default: 12 },
};
const parameter = (name: string, location = "query", required = false) => ({
  name,
  in: location,
  required,
  schema: { type: "string" },
});
const security = [{ adminCookie: [] }];
const userSecurity = [{ userCookie: [] }];
const json = (properties: object, required: string[] = []) => ({
  required: true,
  content: {
    "application/json": { schema: { type: "object", properties, required } },
  },
});
const operation = (
  summary: string,
  parameters: object[] = [],
  secured = false,
) => ({
  summary,
  parameters,
  ...(secured ? { security } : {}),
  responses: { 200: ok, 400: ok, 401: ok, 404: ok, 429: ok },
});
const paths: Record<string, object> = {};
for (const entity of ["regions", "provinces", "destinations", "specialties"]) {
  paths[`/${entity}`] = {
    get: operation(`List ${entity}`, [
      lang,
      page,
      limit,
      parameter("q"),
      parameter("regionId"),
      parameter("provinceId"),
      parameter("category"),
      parameter("sort"),
    ]),
  };
  paths[`/${entity}/{slug}`] = {
    get: operation(`Read ${entity}`, [lang, parameter("slug", "path", true)]),
  };
}
paths["/auth/login"] = {
  post: {
    ...operation("Admin login; sets httpOnly cookie"),
    requestBody: json(
      {
        email: { type: "string", format: "email" },
        password: { type: "string" },
      },
      ["email", "password"],
    ),
  },
};
paths["/auth/me"] = { get: operation("Current admin", [], true) };
paths["/auth/logout"] = { post: operation("Revoke admin sessions", [], true) };
paths["/auth/providers"] = { get: operation("Available user OAuth providers") };
paths["/auth/user/register"] = {
  post: operation("Register a community account with email and password"),
};
paths["/auth/user/login"] = {
  post: operation("Community user login; sets httpOnly cookie"),
};
paths["/auth/user/password/forgot"] = {
  post: operation("Request a community password reset"),
};
paths["/auth/user/password/reset"] = {
  post: operation("Reset a community account password"),
};
paths["/auth/user/me"] = {
  get: { ...operation("Current community user"), security: userSecurity },
};
paths["/auth/user/profile"] = {
  patch: {
    ...operation("Update community user profile"),
    security: userSecurity,
    requestBody: json({
      name: { type: "string", maxLength: 100 },
      bio: { type: "string", maxLength: 500 },
      location: { type: "string", maxLength: 120 },
      locale: { type: "string", enum: ["vi", "en"] },
    }),
  },
};
paths["/auth/user/logout"] = {
  post: {
    ...operation("Revoke community user sessions"),
    security: userSecurity,
  },
};
paths["/search"] = {
  get: operation("Search grouped content", [
    lang,
    parameter("q", "query", true),
  ]),
};
paths["/discover"] = { get: operation("Homepage content", [lang]) };
paths["/discover/random"] = {
  get: operation("Random published destination", [lang]),
};
const guest = {
  destinationId: { type: "string" },
  locale: { type: "string", enum: ["vi", "en"] },
  website: { type: "string", maxLength: 0 },
  captchaToken: { type: "string" },
};
paths["/community"] = {
  get: operation("Approved photographs", [
    lang,
    page,
    limit,
    parameter("destinationId"),
  ]),
  post: {
    ...operation("Upload image; always pending"),
    security: userSecurity,
    requestBody: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            required: ["image", "destinationId"],
            properties: {
              ...guest,
              image: { type: "string", format: "binary" },
              caption: { type: "string", maxLength: 2000 },
              takenAt: { type: "string", format: "date" },
            },
          },
        },
      },
    },
    responses: { 201: ok, 400: ok, 413: ok, 429: ok },
  },
};
paths["/comments"] = {
  get: operation("Approved comments", [
    lang,
    page,
    limit,
    parameter("destinationId"),
    parameter("communityPostId"),
  ]),
  post: {
    ...operation("Submit pending comment"),
    security: userSecurity,
    requestBody: json(
      {
        ...guest,
        communityPostId: { type: "string" },
        content: { type: "string", minLength: 5, maxLength: 2000 },
      },
      ["destinationId", "content"],
    ),
    responses: { 201: ok, 400: ok, 429: ok },
  },
};
paths["/admin/dashboard"] = {
  get: operation("Counts and recent activity", [], true),
};
paths["/admin/account"] = {
  get: operation("Current admin account", [], true),
  patch: {
    ...operation("Update admin profile or credentials", [], true),
    requestBody: json({
      name: { type: "string", maxLength: 100 },
      email: { type: "string", format: "email" },
      currentPassword: { type: "string" },
      newPassword: { type: "string", minLength: 12 },
    }),
  },
};
paths["/admin/{entity}"] = {
  get: operation(
    "Admin list",
    [
      parameter("entity", "path", true),
      page,
      limit,
      parameter("status"),
      parameter("q"),
    ],
    true,
  ),
  post: {
    ...operation(
      "Create bilingual content",
      [parameter("entity", "path", true)],
      true,
    ),
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            description:
              "Model-shaped object; translations are {vi,en}. See docs/API.md.",
          },
        },
      },
    },
    responses: { 201: ok, 400: ok, 409: ok },
  },
};
paths["/admin/{entity}/{id}"] = {
  patch: {
    ...operation(
      "Update content",
      [parameter("entity", "path", true), parameter("id", "path", true)],
      true,
    ),
    requestBody: json({}),
  },
  delete: operation(
    "Permanently delete record and unreferenced uploaded media",
    [parameter("entity", "path", true), parameter("id", "path", true)],
    true,
  ),
};
paths["/admin/{entity}/moderate"] = {
  patch: {
    ...operation(
      "Approve or reject",
      [parameter("entity", "path", true)],
      true,
    ),
    requestBody: json(
      {
        ids: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: { type: "string" },
        },
        action: { type: "string", enum: ["approve", "reject"] },
      },
      ["ids", "action"],
    ),
  },
};
paths["/admin/media"] = {
  post: {
    ...operation("Upload official image", [], true),
    requestBody: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            required: ["image"],
            properties: { image: { type: "string", format: "binary" } },
          },
        },
      },
    },
    responses: { 201: ok, 400: ok, 413: ok },
  },
};
paths["/admin/media/{id}"] = {
  delete: operation(
    "Remove unreferenced media",
    [parameter("id", "path", true)],
    true,
  ),
};
paths["/media/{id}"] = {
  get: {
    ...operation("Read image; pending community media requires admin", [
      parameter("id", "path", true),
    ]),
    responses: {
      200: {
        description: "Normalized image",
        content: {
          "image/webp": { schema: { type: "string", format: "binary" } },
        },
      },
      401: ok,
      404: ok,
    },
  },
};
export const openApi = {
  openapi: "3.1.0",
  info: {
    title: "Vietnam Heritage API",
    version: "1.0.0",
    description:
      "Mutations require matching Origin. Public content must be published or approved. Vietnamese is the default language.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      adminCookie: { type: "apiKey", in: "cookie", name: "atlas_session" },
      userCookie: {
        type: "apiKey",
        in: "cookie",
        name: "heritage_user_session",
      },
    },
    schemas: {
      Envelope: {
        type: "object",
        required: ["success", "data", "message"],
        properties: {
          success: { type: "boolean" },
          data: {},
          message: { type: "string" },
          pagination: {
            type: "object",
            properties: {
              page: { type: "integer" },
              limit: { type: "integer" },
              total: { type: "integer" },
              pages: { type: "integer" },
            },
          },
        },
      },
    },
  },
  paths,
};
