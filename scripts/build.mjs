import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = new URL("../source/", import.meta.url);
const server = new URL("../dist/server/", import.meta.url);
const readText = async (name) => (await readFile(new URL(name, source), "utf8")).replace(/\r\n?/g, "\n");
const digest = (value) => "sha256-" + createHash("sha256").update(value).digest("base64");

const [template, css, js] = await Promise.all(["index.html", "styles.css", "app.js"].map(readText));
const style = "\n" + css.trim() + "\n  ";
const script = "\n" + js.trim() + "\n  ";
const images = {
  character: "character.png",
  sweatshirt: "sweatshirt.jpg",
  "model-1": "model-1.jpg",
  "model-2": "model-2.jpg",
  "model-3": "model-3.jpg",
  "thumb-sweatshirt": "thumb-sweatshirt.jpg",
  "thumb-character": "thumb-character.jpg",
  "thumb-model-1": "thumb-model-1.jpg",
  "thumb-model-2": "thumb-model-2.jpg",
  "thumb-model-3": "thumb-model-3.jpg",
};
const urls = new Map(await Promise.all(Object.entries(images).map(async ([name, filename]) => {
  const image = await readFile(new URL("images/" + filename, source));
  const format = filename.endsWith(".png") ? "png" : "jpeg";
  return [name, `data:image/${format};base64,${image.toString("base64")}`];
})));
const html = template
  .replace(/<style>\s*\/\* @styles \*\/\s*<\/style>/, () => "<style>" + style + "</style>")
  .replace(/<script>\s*\/\* @script \*\/\s*<\/script>/, () => "<script>" + script + "</script>")
  .replace(/@@([\w-]+)@@/g, (_, name) => {
    if (!urls.has(name)) throw new Error("Missing image: " + name);
    return urls.get(name);
  });
const inlineScript = digest(script);
const inlineStyle = digest(style);

const worker = await readFile(new URL("../worker/index.mjs", import.meta.url), "utf8");
const code = worker.replace(/^import \{ assets, inlineScript, inlineStyle \} from "\.\/assets\.mjs";\r?\n/, "");
const assets = `const assets = {
  "/index.html": { type: "text/html; charset=utf-8", body: () => ${JSON.stringify(html)} },
  "/styles.css": { type: "text/css; charset=utf-8", body: () => ${JSON.stringify(style)} },
  "/sweatshirt.jpg": { type: "image/jpeg", body: () => Uint8Array.from(atob(${JSON.stringify(urls.get("sweatshirt").split(",")[1])}), (byte) => byte.charCodeAt(0)) }
};
const inlineScript = ${JSON.stringify(inlineScript)};
const inlineStyle = ${JSON.stringify(inlineStyle)};
`;
await mkdir(server, { recursive: true });
await Promise.all([
  writeFile(new URL("index.js", server), assets + code),
  writeFile(new URL("../dist/index.html", import.meta.url), html),
  ...(process.argv[2] ? [writeFile(resolve(process.argv[2]), html)] : []),
]);
console.log("Built the single-file site and Worker.");
