#!/usr/bin/env node
/*
  Static server for the harness — port 3000 because that is an allowed
  app origin for /api/extension/*, so the popup's fetches are accepted
  by a dev server on 3100. No dependencies.

  Usage: node harness/serve.mjs   →  http://localhost:3000/harness/harness.html
*/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
    if (path.includes("..")) throw new Error("traversal");
    const file = join(root, path);
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(3000, () => console.log("harness → http://localhost:3000/harness/harness.html"));
