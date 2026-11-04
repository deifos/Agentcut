import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import workerModule from "../workers/share/src/index.ts";
const worker = workerModule.default ?? workerModule;
import { PhoneInbox } from "../workers/share/src/phone.ts";
import { PhoneTransfers } from "../packages/agentcut/src/studio/phone.ts";
import { DEFAULT_PHONE_EDITING, phoneEditPrompt } from "../packages/agentcut/src/studio/phone-editing.ts";
import {
  phoneSecret,
  sealPhone,
  openPhone,
  phoneResultKey,
  phoneResultToken,
  openPhoneResult,
  PHONE_TTL,
} from "../packages/agentcut/src/studio/phone-protocol.ts";

function relay() {
  const objects = new Map(),
    coordinators = new Map(),
    stores = new Map();
  const env = {
    PHONE_ENABLED: "true",
    ALLOWED_ORIGINS: "http://localhost:3000",
    SIGNING_SECRET: "test-only",
    CREATE_LIMITER: { limit: async () => ({ success: true }) },
    BUCKET: {
      put: async (k, v) => {
        objects.set(k, v.slice(0));
        return {};
      },
      get: async (k) =>
        objects.has(k) ? { body: new Blob([objects.get(k)]).stream() } : null,
      delete: async (keys) => {
        keys.forEach((k) => objects.delete(k));
      },
    },
    PHONES: {
      idFromName: (id) => id,
      get: (id) => {
        if (!coordinators.has(id)) {
          const data = new Map();
          stores.set(id, data);
          const storage = {
            get: async (k) => structuredClone(data.get(k)),
            put: async (k, v) => {
              data.set(k, structuredClone(v));
            },
            delete: async (k) => data.delete(k),
            list: async ({ prefix }) =>
              new Map(
                [...data]
                  .filter(([k]) => k.startsWith(prefix))
                  .map(([k, v]) => [k, structuredClone(v)]),
              ),
            setAlarm: async () => {},
          };
          let lock = Promise.resolve();
          const state = {
            storage,
            blockConcurrencyWhile: (fn) => {
              const next = lock.then(fn);
              lock = next.catch(() => {});
              return next;
            },
          };
          coordinators.set(id, new PhoneInbox(state, env));
        }
        return coordinators.get(id);
      },
    },
  };
  return {
    env,
    objects,
    stores,
    coordinators,
    fetch: (request) => worker.fetch(request, env, { waitUntil() {} }),
  };
}
async function connection(r) {
  const desktop = phoneSecret(),
    invite = phoneSecret(),
    phone = phoneSecret();
  const response = await r.fetch(
    new Request("http://relay/v1/phone", {
      method: "POST",
      body: JSON.stringify({ desktop, invite }),
    }),
  );
  assert.equal(response.status, 201);
  const { id } = await response.json();
  const call = (token, path, method = "GET", body) =>
    r.fetch(
      new Request(`http://relay/v1/phone/${id}/${path}`, {
        method,
        headers: { authorization: `Bearer ${token}` },
        ...(body === undefined
          ? {}
          : {
              body:
                typeof body === "object" && !(body instanceof Uint8Array)
                  ? JSON.stringify(body)
                  : body,
            }),
      }),
    );
  assert.equal(
    (await call(invite, "claim", "POST", { token: phone })).status,
    200,
  );
  return { id, desktop, invite, phone, call };
}

test("phone encryption binds each part to its job and direction", async () => {
  const secret = phoneSecret(),
    input = new TextEncoder().encode("private video");
  const sealed = await sealPhone(secret, "job-a", "input/0", input);
  assert.deepEqual(
    await openPhone(secret, "job-a", "input/0", sealed.buffer),
    input,
  );
  await assert.rejects(openPhone(secret, "job-b", "input/0", sealed.buffer));
  await assert.rejects(openPhone(secret, "job-a", "result/0", sealed.buffer));
  sealed[15] ^= 1;
  await assert.rejects(openPhone(secret, "job-a", "input/0", sealed.buffer));
});

test("a result link contains only a per-video key and capability", async () => {
  const secret = phoneSecret(),
    job = crypto.randomUUID();
  const resultKey = await phoneResultKey(secret, job);
  const capability = await phoneResultToken(secret, job);
  assert.notEqual(resultKey, secret);
  assert.notEqual(capability, secret);
  assert.notEqual(capability, resultKey);
  assert.equal(capability, await phoneResultToken(secret, job));
  assert.notEqual(
    capability,
    await phoneResultToken(secret, crypto.randomUUID()),
  );
  const plain = new TextEncoder().encode("one finished video");
  const encrypted = await sealPhone(secret, job, "result/0", plain);
  assert.deepEqual(
    await openPhoneResult(resultKey, job, "result/0", encrypted.buffer),
    plain,
  );
  await assert.rejects(
    openPhoneResult(
      resultKey,
      crypto.randomUUID(),
      "result/0",
      encrypted.buffer,
    ),
  );
  await assert.rejects(
    openPhoneResult(resultKey, job, "input/0", encrypted.buffer),
  );
});

test("pairing is single-use, claims are retry-safe, and role boundaries hold", async () => {
  const r = relay(),
    c = await connection(r);
  assert.equal(
    (await c.call(c.invite, "claim", "POST", { token: c.phone })).status,
    200,
  );
  assert.equal(
    (await c.call(c.invite, "claim", "POST", { token: phoneSecret() })).status,
    409,
  );
  assert.equal((await c.call(c.invite, "jobs")).status, 401);
  assert.equal(
    (
      await c.call(c.desktop, "jobs", "POST", {
        id: crypto.randomUUID(),
        bytes: 3,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await r.fetch(
        new Request(`http://relay/v1/phone/${crypto.randomUUID()}/init`, {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
    404,
  );
  const id = crypto.randomUUID();
  assert.equal(
    (await c.call(c.phone, "jobs", "POST", { id, bytes: 3 })).status,
    201,
  );
  assert.equal(
    (await c.call(c.phone, `jobs/${id}/commit`, "POST")).status,
    409,
  );
  assert.equal(
    (await c.call(c.phone, `jobs/${id}/status`, "POST", { stage: "editing" }))
      .status,
    404,
  );
  assert.equal(
    (await c.call(c.desktop, `jobs/${id}/status`, "POST", { stage: "done" }))
      .status,
    409,
  );
  assert.equal(
    (await c.call(c.phone, `jobs/${id}/input/0`, "PUT", new Uint8Array(32)))
      .status,
    413,
  );
  assert.equal((await c.call(c.desktop, "revoke", "POST")).status, 200);
  assert.equal((await c.call(c.phone, "jobs")).status, 410);
});

test("internal initialization cannot bypass the connection creation limit", async () => {
  const r = relay();
  r.env.CREATE_LIMITER.limit = async () => ({ success: false });
  const credentials = { desktop: phoneSecret(), invite: phoneSecret() };
  for (const suffix of ["init", "init/", "init/extra"]) {
    const response = await r.fetch(
      new Request(`http://relay/v1/phone/${crypto.randomUUID()}/${suffix}`, {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    );
    assert.equal(response.status, 404);
  }
  assert.equal(r.coordinators.size, 0);
  assert.equal(
    (
      await r.fetch(
        new Request("http://relay/v1/phone", {
          method: "POST",
          body: JSON.stringify(credentials),
        }),
      )
    ).status,
    429,
  );
});

test("concurrent jobs cannot exceed the phone queue limit", async () => {
  const r = relay(),
    c = await connection(r);
  const responses = await Promise.all(
    Array.from({ length: 21 }, () =>
      c.call(c.phone, "jobs", "POST", { id: crypto.randomUUID(), bytes: 1 }),
    ),
  );
  assert.equal(responses.filter((r) => r.status === 201).length, 20);
  assert.equal(responses.filter((r) => r.status === 429).length, 1);
  assert.equal((await (await c.call(c.phone, "jobs")).json()).jobs.length, 20);
});

test("cleanup waits for an active upload before deleting expired objects", async () => {
  const r = relay(),
    c = await connection(r),
    id = crypto.randomUUID();
  await c.call(c.phone, "jobs", "POST", { id, bytes: 1 });
  let release, started;
  const uploading = new Promise((resolve) => {
    started = resolve;
  });
  const paused = new Promise((resolve) => {
    release = resolve;
  });
  const put = r.env.BUCKET.put;
  r.env.BUCKET.put = async (...args) => {
    started();
    await paused;
    return put(...args);
  };
  const upload = c.call(
    c.phone,
    `jobs/${id}/input/0`,
    "PUT",
    new Uint8Array(29),
  );
  await uploading;
  const originalNow = Date.now;
  Date.now = () => originalNow() + PHONE_TTL + 1000;
  try {
    const cleanup = r.coordinators.get(c.id).alarm();
    release();
    assert.equal((await upload).status, 200);
    await cleanup;
    assert.equal(r.objects.size, 0);
    assert.equal(r.stores.get(c.id).has(`job:${id}`), false);
  } finally {
    Date.now = originalNow;
    release();
  }
});

for (const editing of [undefined, DEFAULT_PHONE_EDITING]) {
test(`complete transfer (${editing ? "social" : "legacy"}): encrypted upload, local edit, render, encrypted result, no duplicate edit`, async (t) => {
  const r = relay();
  let failResultOnce = true;
  const server = createServer(async (req, res) => {
    const parts = [];
    for await (const part of req) parts.push(part);
    const data = Buffer.concat(parts);
    if (
      failResultOnce &&
      req.url.endsWith("/result/0") &&
      req.method === "PUT"
    ) {
      failResultOnce = false;
      res.writeHead(503);
      res.end("Temporary outage");
      return;
    }
    const response = await r.fetch(
      new Request(`http://127.0.0.1${req.url}`, {
        method: req.method,
        headers: req.headers,
        ...(data.length ? { body: data } : {}),
      }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const root = mkdtempSync(join(tmpdir(), "agentcut-phone-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  let edits = 0,
    renders = 0;
  const original = new TextEncoder().encode("test video payload"),
    result = new TextEncoder().encode("edited mp4 payload");
  const deps = {
    internal: root,
    available: () => true,
    import: () => {
      const dir = join(root, "project", "assets");
      mkdirSync(dir, { recursive: true });
      return { slug: "phone-video", file: join(dir, "footage.mp4") };
    },
    edit: async (_slug, prompt) => {
      edits++;
      assert.equal(prompt, phoneEditPrompt("Remove pauses.", editing));
      assert.deepEqual(
        new Uint8Array(
          readFileSync(join(root, "project", "assets", "footage.mp4")),
        ),
        original,
      );
    },
    render: async (_slug, receivedEditing) => {
      assert.deepEqual(receivedEditing, editing);
      renders++;
      const path = join(root, "finished.mp4");
      writeFileSync(path, result);
      return path;
    },
    cancel() {},
  };
  const helper = new PhoneTransfers(deps);
  const status = await helper.connect(
    `http://127.0.0.1:${server.address().port}`,
  );
  const pairing = status.pairing,
    token = phoneSecret();
  const call = (path, method = "GET", body) =>
    r.fetch(
      new Request(`http://relay/v1/phone/${pairing.id}/${path}`, {
        method,
        headers: { authorization: `Bearer ${token}` },
        ...(body === undefined ? {} : { body }),
      }),
    );
  assert.equal(
    (
      await r.fetch(
        new Request(`http://relay/v1/phone/${pairing.id}/claim`, {
          method: "POST",
          headers: { authorization: `Bearer ${pairing.invite}` },
          body: JSON.stringify({ token }),
        }),
      )
    ).status,
    200,
  );
  const id = crypto.randomUUID();
  await call("jobs", "POST", JSON.stringify({ id, bytes: original.length }));
  await call(
    `jobs/${id}/input/0`,
    "PUT",
    await sealPhone(pairing.secret, id, "input/0", original),
  );
  const manifest = {
    editing,
    name: "phone.mp4",
    prompt: "Remove pauses.",
    bytes: original.length,
    width: 1080,
    height: 1920,
    duration: 4,
    extension: "mp4",
  };
  await call(
    `jobs/${id}/input/manifest`,
    "PUT",
    await sealPhone(
      pairing.secret,
      id,
      "input/manifest",
      new TextEncoder().encode(JSON.stringify(manifest)),
    ),
  );
  assert.equal((await call(`jobs/${id}/commit`, "POST")).status, 200);
  assert.equal((await call(`jobs/${id}/input/0`)).status, 403);
  await helper.tick();
  assert.equal(edits, 1);
  assert.equal(renders, 1);
  assert.equal((await (await call("jobs")).json()).jobs[0].stage, "returning");
  // Retrying an interrupted return transfer must not repeat the paid edit or render.
  await helper.tick();
  assert.equal(edits, 1);
  assert.equal(renders, 1);
  assert.equal((await (await call("jobs")).json()).jobs[0].stage, "done");
  assert.equal(
    [...r.objects.keys()].some((k) => k.includes("/input/")),
    false,
    "input removed after receipt",
  );
  const encryptedResult = await (
    await call(`jobs/${id}/result/0`)
  ).arrayBuffer();
  assert.deepEqual(
    await openPhone(pairing.secret, id, "result/0", encryptedResult),
    result,
  );
  await helper.tick();
  await new PhoneTransfers(deps).tick();
  assert.equal(edits, 1);
  assert.equal(renders, 1);
  const store = r.stores.get(pairing.id),
    job = store.get(`job:${id}`);
  const capability = await phoneResultToken(pairing.secret, id);
  const resultKey = await phoneResultKey(pairing.secret, id);
  const privateCall = (path, method = "GET", access = capability) =>
    r.fetch(
      new Request(`http://relay/v1/phone/${pairing.id}/${path}`, {
        method,
        headers: { authorization: `Bearer ${access}` },
      }),
    );
  assert.equal(
    (
      await call(
        `jobs/${id}/link`,
        "POST",
        JSON.stringify({ token: capability }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        `jobs/${id}/link`,
        "POST",
        JSON.stringify({ token: capability }),
      )
    ).status,
    200,
    "link creation is retry-safe",
  );
  assert.equal(
    (
      await call(
        `jobs/${id}/link`,
        "POST",
        JSON.stringify({ token: phoneSecret() }),
      )
    ).status,
    409,
  );
  assert.equal((await privateCall("jobs")).status, 401);
  assert.equal((await privateCall("revoke", "POST")).status, 401);
  assert.equal((await privateCall(`jobs/${id}/input/0`)).status, 401);
  assert.equal(
    (await privateCall(`results/${id}`, "GET", phoneSecret())).status,
    401,
  );
  assert.equal(
    (await privateCall(`results/${crypto.randomUUID()}`)).status,
    410,
  );
  assert.equal((await privateCall(`results/${id}/input/0`)).status, 404);
  assert.equal(
    (await privateCall(`results/${id}/result/0`, "PUT")).status,
    405,
  );
  const info = await (await privateCall(`results/${id}`)).json();
  assert.equal(info.bytes, result.length);
  assert.deepEqual(
    await openPhoneResult(
      resultKey,
      id,
      "result/0",
      await (await privateCall(`results/${id}/result/0`)).arrayBuffer(),
    ),
    result,
  );
  const removeObjects = r.env.BUCKET.delete;
  r.env.BUCKET.delete = async () => {
    throw new Error("Temporary storage outage");
  };
  assert.equal((await privateCall(`results/${id}/delete`, "POST")).status, 500);
  assert.equal(
    (await privateCall(`results/${id}/result/0`)).status,
    410,
    "a failed cleanup cannot restore access",
  );
  r.env.BUCKET.delete = removeObjects;
  assert.equal((await privateCall(`results/${id}/delete`, "POST")).status, 200);
  assert.equal(
    (await privateCall(`results/${id}/delete`, "POST")).status,
    200,
    "delete is retry-safe",
  );
  assert.equal((await privateCall(`results/${id}`)).status, 410);
  assert.equal((await privateCall(`results/${id}/result/0`)).status, 410);
  assert.equal((await call(`jobs/${id}/result/0`)).status, 410);
  assert.equal(
    (
      await call(
        `jobs/${id}/link`,
        "POST",
        JSON.stringify({ token: capability }),
      )
    ).status,
    410,
  );
  assert.equal((await (await call("jobs")).json()).jobs[0].resultDeleted, true);
  assert.equal(r.objects.size, 0);
  assert.deepEqual(
    new Uint8Array(readFileSync(join(root, "finished.mp4"))),
    result,
    "deleting online leaves the local render intact",
  );
  await helper.tick();
  assert.equal(edits, 1);
  assert.equal(renders, 1);
  job.created = Date.now() - PHONE_TTL - 1;
  store.set(`job:${id}`, job);
  await r.coordinators.get(pairing.id).alarm();
  assert.equal(r.objects.size, 0);
  assert.equal((await call(`jobs/${id}/result/0`)).status, 410);
  assert.equal((await privateCall(`results/${id}`)).status, 410);
});

}

test("an interrupted edit is reported, never silently repeated", async () => {
  const root = mkdtempSync(join(tmpdir(), "agentcut-phone-restart-"));
  const originalFetch = globalThis.fetch;
  try {
    const connection = {
      id: crypto.randomUUID(),
      token: phoneSecret(),
      secret: phoneSecret(),
      api: "https://relay",
      invite: phoneSecret(),
      expires: Date.now() + 10000,
    };
    writeFileSync(
      join(root, "phone-connection.json"),
      JSON.stringify(connection),
    );
    mkdirSync(join(root, "phone-jobs"));
    const job = {
      id: crypto.randomUUID(),
      stage: "editing",
      created: Date.now(),
      bytes: 3,
      chunks: 1,
    };
    writeFileSync(
      join(root, "phone-jobs", `${job.id}.json`),
      JSON.stringify({
        id: job.id,
        connection: connection.id,
        slug: "saved-video",
        stage: "editing",
      }),
    );
    const states = [];
    globalThis.fetch = async (url, init) =>
      String(url).endsWith("/jobs")
        ? Response.json({ paired: true, jobs: [job] })
        : (states.push(JSON.parse(init.body).stage),
          Response.json({ ok: true }));
    const helper = new PhoneTransfers({
      internal: root,
      available: () => true,
      import() {
        assert.fail();
      },
      edit() {
        assert.fail();
      },
      render() {
        assert.fail();
      },
      cancel() {},
    });
    await helper.tick();
    assert.deepEqual(states, ["error"]);
    assert.equal(
      JSON.parse(
        readFileSync(
          join(root, "phone-jobs", readdirSync(join(root, "phone-jobs"))[0]),
          "utf8",
        ),
      ).stage,
      "error",
    );
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(root, { recursive: true, force: true });
  }
});
