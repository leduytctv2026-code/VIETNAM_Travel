import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import type { Config } from "../config/env.ts";
export interface MediaProvider {
  upload(data: Buffer): Promise<string>;
  delete(key: string): Promise<void>;
  read(key: string): Promise<Readable>;
  getUrl(id: string): string;
}
export class LocalMediaProvider implements MediaProvider {
  root: string;
  constructor(root: string) {
    this.root = path.resolve(root);
  }
  private file(key: string) {
    if (!/^[a-f\d-]+\.webp$/.test(key)) throw new Error("Invalid media key");
    const resolved = path.resolve(this.root, key);
    if (path.dirname(resolved) !== this.root)
      throw new Error("Invalid media path");
    return resolved;
  }
  async upload(data: Buffer) {
    await mkdir(this.root, { recursive: true });
    const key = `${randomUUID()}.webp`;
    await writeFile(this.file(key), data, { flag: "wx" });
    return key;
  }
  async delete(key: string) {
    await unlink(this.file(key)).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  async read(key: string) {
    return createReadStream(this.file(key));
  }
  getUrl(id: string) {
    return `/api/v1/media/${id}`;
  }
}
export class S3MediaProvider implements MediaProvider {
  private client: S3Client;
  constructor(private config: Config) {
    this.client = new S3Client({
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: !!config.S3_ENDPOINT,
      ...(config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: config.S3_ACCESS_KEY_ID,
              secretAccessKey: config.S3_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
  }
  async upload(data: Buffer) {
    const key = `heritage/${randomUUID()}.webp`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.S3_BUCKET,
        Key: key,
        Body: data,
        ContentType: "image/webp",
      }),
    );
    return key;
  }
  async delete(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.S3_BUCKET, Key: key }),
    );
  }
  async read(key: string) {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.S3_BUCKET, Key: key }),
    );
    return response.Body as Readable;
  }
  getUrl(id: string) {
    return `/api/v1/media/${id}`;
  }
}
export function createMediaProvider(config: Config): MediaProvider {
  return config.MEDIA_PROVIDER === "s3"
    ? new S3MediaProvider(config)
    : new LocalMediaProvider(config.MEDIA_ROOT);
}
