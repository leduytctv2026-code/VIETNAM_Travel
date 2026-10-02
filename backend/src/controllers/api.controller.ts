import type { Request, Response } from "express";
import { z } from "zod";
import type { Config } from "../config/env.ts";
import type { ContentCollection } from "../models/index.ts";
import type { MediaProvider } from "../providers/media.ts";
import { send, language, translate, toJSON } from "../utils/http.ts";
import * as content from "../services/content.service.ts";
import * as authentication from "../services/auth.service.ts";
import * as userAuthentication from "../services/user-auth.service.ts";
import * as oauth from "../services/oauth.service.ts";
import * as admin from "../services/admin.service.ts";
const param = (req: Request, key: string) => String(req.params[key]);
const localized = (req: Request, data: unknown) =>
  translate(toJSON(data), language(req.query.lang));
export const catalog =
  (entity: ContentCollection) => async (req: Request, res: Response) => {
    const result = await content.catalog(entity, req.query);
    send(res, localized(req, result.data), 200, result.pagination);
  };
export const detail =
  (entity: ContentCollection) => async (req: Request, res: Response) => {
    send(res, localized(req, await content.detail(entity, param(req, "slug"))));
  };
export const home = async (req: Request, res: Response) => {
  send(res, localized(req, await content.homeData()));
};
export const search = async (req: Request, res: Response) => {
  send(
    res,
    await content.search(
      typeof req.query.q === "string" ? req.query.q : "",
      language(req.query.lang),
    ),
  );
};
export const random = async (req: Request, res: Response) => {
  send(res, localized(req, await content.randomDestination()));
};
export const login =
  (config: Config) => async (req: Request, res: Response) => {
    const data = z
      .object({
        email: z.email().max(254),
        password: z.string().min(1).max(200),
      })
      .strict()
      .parse(req.body);
    const result = await authentication.login(
      data.email,
      data.password,
      config,
    );
    res.cookie(
      "atlas_session",
      result.token,
      authentication.cookieOptions(config),
    );
    send(res, result.user);
  };
export const logout =
  (config: Config) => async (_req: Request, res: Response) => {
    await authentication.logout(res.locals.admin!.id);
    res.clearCookie("atlas_session", authentication.cookieOptions(config));
    send(res, { ok: true });
  };
export const userMe = (_req: Request, res: Response) =>
  send(res, res.locals.user);
const userCredentialsSchema = z
  .object({
    email: z.email().max(254),
    password: z.string().min(12).max(200),
  })
  .strict();
const setUserCookie = (
  res: Response,
  result: { token: string },
  config: Config,
) =>
  res.cookie(
    "heritage_user_session",
    result.token,
    userAuthentication.userCookieOptions(config),
  );
export const registerUser =
  (config: Config) => async (req: Request, res: Response) => {
    const data = userCredentialsSchema
      .extend({ name: z.string().trim().min(1).max(100) })
      .parse(req.body);
    const result = await userAuthentication.registerUser(
      data.name,
      data.email,
      data.password,
      config,
    );
    setUserCookie(res, result, config);
    send(res, result.user, 201);
  };
export const loginUser =
  (config: Config) => async (req: Request, res: Response) => {
    const data = userCredentialsSchema
      .extend({ password: z.string().min(1).max(200) })
      .parse(req.body);
    const result = await userAuthentication.loginUser(
      data.email,
      data.password,
      config,
    );
    setUserCookie(res, result, config);
    send(res, result.user);
  };
export const forgotUserPassword =
  (config: Config) => async (req: Request, res: Response) => {
    const { email } = z
      .object({ email: z.email().max(254) })
      .strict()
      .parse(req.body);
    const token = await userAuthentication.requestUserPasswordReset(email);
    send(res, {
      message: "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được tạo.",
      // Local/test projects have no mail transport. Never expose this in prod.
      ...(config.NODE_ENV !== "production" && token
        ? { developmentResetToken: token }
        : {}),
    });
  };
export const resetUserPassword = async (req: Request, res: Response) => {
  const data = z
    .object({
      token: z.string().min(32).max(200),
      password: z.string().min(12).max(200),
    })
    .strict()
    .parse(req.body);
  await userAuthentication.resetUserPassword(data.token, data.password);
  send(res, { ok: true });
};
export const updateUserProfile = async (req: Request, res: Response) =>
  send(
    res,
    await userAuthentication.updateUserProfile(res.locals.user!.id, req.body),
  );
export const userLogout =
  (config: Config) => async (_req: Request, res: Response) => {
    await userAuthentication.logoutUser(res.locals.user!.id);
    res.clearCookie(
      "heritage_user_session",
      userAuthentication.userCookieOptions(config),
    );
    send(res, { ok: true });
  };
export const oauthProviders =
  (config: Config) => (_req: Request, res: Response) =>
    send(res, oauth.oauthProviders(config));
export const beginOAuth =
  (provider: "google" | "facebook", config: Config) =>
  async (_req: Request, res: Response) => {
    res.redirect(await oauth.beginOAuth(provider, config, res));
  };
export const finishOAuth =
  (provider: "google" | "facebook", config: Config) =>
  async (req: Request, res: Response) => {
    try {
      const result = await oauth.finishOAuth(provider, req, res, config);
      res.cookie(
        "heritage_user_session",
        result.token,
        oauth.userCookieOptions(config),
      );
      res.redirect(oauth.oauthSuccessUrl(config));
    } catch {
      // OAuth provider responses can contain sensitive implementation details;
      // always redirect with a generic failure state instead of exposing them.
      res.redirect(oauth.oauthFailureUrl(config));
    }
  };
export const adminAccount = async (_req: Request, res: Response) =>
  send(res, await authentication.adminAccount(res.locals.admin!.id));
export const updateAdminAccount =
  (config: Config) => async (req: Request, res: Response) => {
    const result = await authentication.updateAdminAccount(
      res.locals.admin!.id,
      req.body,
    );
    if (result.sessionRevoked)
      res.clearCookie("atlas_session", authentication.cookieOptions(config));
    send(res, result);
  };
export const adminList = async (req: Request, res: Response) => {
  const result = await admin.adminList(
    admin.collection(param(req, "entity")),
    req.query,
  );
  send(res, result.data, 200, result.pagination);
};
export const create = async (req: Request, res: Response) => {
  send(
    res,
    await admin.saveContent(admin.collection(param(req, "entity")), req.body),
    201,
  );
};
export const update = async (req: Request, res: Response) => {
  send(
    res,
    await admin.saveContent(
      admin.collection(param(req, "entity")),
      req.body,
      param(req, "id"),
    ),
  );
};
export const remove =
  (provider: MediaProvider) => async (req: Request, res: Response) => {
    send(
      res,
      await admin.removeContent(
        admin.collection(param(req, "entity")),
        param(req, "id"),
        provider,
      ),
    );
  };
