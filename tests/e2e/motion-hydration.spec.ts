import { expect, test } from "@playwright/test";

test("home hydrates without Motion errors when reduced motion is enabled", async ({
  page,
}) => {
  const motionErrors: string[] = [];
  const record = (message: string) => {
    if (
      message.includes("Target ref is defined but not hydrated") ||
      message.includes("A tree hydrated but some attributes")
    )
      motionErrors.push(message);
  };

  page.on("console", (message) => record(message.text()));
  page.on("pageerror", (error) => record(error.message));

  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await page.waitForTimeout(250);

  expect(motionErrors).toEqual([]);
});
