import { describe, expect, it } from "vitest";
import { validateMongoConnectionString } from "../src/config/database.js";

describe("validateMongoConnectionString", () => {
  it("accepts valid MongoDB connection schemes", () => {
    expect(
      validateMongoConnectionString("mongodb://localhost:27017/heritage"),
    ).toBe("mongodb://localhost:27017/heritage");
    expect(
      validateMongoConnectionString(
        "mongodb+srv://user:password@cluster.example.mongodb.net/heritage",
      ),
    ).toBe("mongodb+srv://user:password@cluster.example.mongodb.net/heritage");
  });

  it("rejects a URI with an embedded environment-variable assignment", () => {
    expect(() =>
      validateMongoConnectionString(
        "MONGODB_URI=mongodb+srv://user:password@cluster.example.mongodb.net/heritage",
      ),
    ).toThrow("must contain only the MongoDB URI");
  });

  it("rejects non-MongoDB schemes and Atlas placeholders", () => {
    expect(() => validateMongoConnectionString("https://example.test")).toThrow(
      "must start with mongodb:// or mongodb+srv://",
    );
    expect(() =>
      validateMongoConnectionString(
        "mongodb+srv://<user>:<password>@cluster.example.mongodb.net/heritage",
      ),
    ).toThrow("without < or > placeholders");
  });
});
