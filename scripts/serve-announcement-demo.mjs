import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const page = readFileSync(
  new URL("../tests/fixtures/instagram-story.html", import.meta.url),
);
createServer((request, response) => {
  if (request.url !== "/" && request.url !== "/favicon.ico") {
    response.writeHead(404);
    response.end();
    return;
  }
  response.setHeader("content-type", "text/html");
  response.setHeader("cache-control", "no-store");
  response.end(page);
}).listen(32129, "127.0.0.1", () =>
  console.log("Isolated, fictional conversation demo: http://127.0.0.1:32129"),
);
