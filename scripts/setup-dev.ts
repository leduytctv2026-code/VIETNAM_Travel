import { randomBytes } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
await mkdir(".local", { recursive: true });
try {
  await access(".env");
  console.log(".env already exists; no changes made.");
} catch {
  const password = randomBytes(18).toString("base64url");
  await writeFile(
    ".env",
    `DATABASE_URL=mongodb+srv://<user>:<password>@<cluster>/vietnam_heritage?retryWrites=true&w=majority\nJWT_SECRET=${randomBytes(48).toString("hex")}\nFRONTEND_URL=http://localhost:3000\nAPI_INTERNAL_URL=http://localhost:5000\nPORT=5000\nMEDIA_PROVIDER=local\nMEDIA_ROOT=.local/media\nSEED_ADMIN_EMAIL=editor@heritage.local\nSEED_ADMIN_PASSWORD=${password}\n`,
    { flag: "wx" },
  );
  await writeFile(
    ".local/admin-credentials.txt",
    `Development only\nEmail: editor@heritage.local\nPassword: ${password}\n`,
  );
  console.log(
    "Created .env and .local/admin-credentials.txt. Replace the Atlas DATABASE_URL, then run npm run seed.",
  );
}
