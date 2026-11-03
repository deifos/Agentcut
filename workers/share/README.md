# Share links Worker

The Cloudflare Worker behind **Share** in the studio. The helper encrypts a project on the sender's
computer and uploads it here; the recipient's helper downloads and decrypts it. The key is only in the
link's `#fragment`, so this Worker and its R2 bucket only ever hold ciphertext.

Project sharing is stateless: limits are checked per request and signed into an upload token, nothing is stored but
the encrypted files. Shares expire after 3 days.

| Limit | Value | Where |
|---|---|---|
| Project size | 1 GB (renders and chat aren't shared) | `MAX_BYTES` in `src/index.ts`, `MAX_SHARE_BYTES` in the helper |
| Files per project | 5,000 | helper |
| New shares per IP | 3 a minute | `[[ratelimits]]` in `wrangler.toml` |
| Upload window | 2 hours after creating a share | `UPLOAD_WINDOW_MS` |
| Expiry | 3 days (Worker refuses older objects; the bucket deletes them) | `TTL_MS` + lifecycle rule |

## Set up (once)

```sh
cd workers/share
npm install
npx wrangler login

# The bucket, and a rule that deletes shares 3 days after upload (the Worker already refuses them then).
npx wrangler r2 bucket create agentcut-shares
npx wrangler r2 bucket lifecycle add agentcut-shares expire-shares shares/ --expire-days 3

# Any long random string; it signs upload tokens.
npx wrangler secret put SIGNING_SECRET

npx wrangler deploy
```

Then give it a custom domain (Cloudflare dashboard → Workers → agentcut-share → Settings → Domains), for
example `share.vladpalacio.com`. Use a custom domain rather than `*.workers.dev`: Cloudflare's cache only
works on custom domains, and the cache is what keeps repeat downloads from counting as R2 reads.

Finally, build the site with the Worker's URL (the Dockerfile passes it through):

```
NEXT_PUBLIC_SHARE_API_URL=https://share.vladpalacio.com
```

Without it the studio hides the Share button. Pages on other origins (self-hosted studios) need adding to
`ALLOWED_ORIGINS` in `wrangler.toml`.

## Keeping costs inside the Workers Paid plan

A share costs a handful of Worker requests and one R2 write per 8 MB; downloads are cached. Set a billing
notification in the Cloudflare dashboard just above your plan so anything unusual shows up early.

**Off switch:** set `SHARING_ENABLED = "false"` in `wrangler.toml` and `npx wrangler deploy`. New shares are
refused at once; existing links keep working until they expire.

## Hosted Agentcut deployment

The `production` environment in `wrangler.toml` uses the existing `vladsmedia` bucket and
`share.vladpalacio.com`. Only objects under `shares/` expire after three days. Keep the existing
bucket lifecycle rules and media domains unchanged.

```sh
npx wrangler deploy --env production
npx wrangler secret list --env production
```

The production `SIGNING_SECRET` is stored in Cloudflare. Normal deployments preserve it. Do not
commit a secret or use the development signing secret in production. The hosted site's build-time
`NEXT_PUBLIC_SHARE_API_URL` is `https://share.vladpalacio.com`.

## Local development

```sh
printf 'SIGNING_SECRET=dev-secret\nALLOWED_ORIGINS=http://localhost:3000\n' > .dev.vars
npx wrangler dev --port 8788
```

Then run the site with `NEXT_PUBLIC_SHARE_API_URL=http://127.0.0.1:8788`. The helper accepts `http://`
only for localhost.

## Phone transfer service

The same Worker now serves `/v1/phone`. Deploy the `PhoneInbox` Durable Object binding and the
`phone-v1` SQLite migration in `wrangler.toml`. Each connection has a separate coordinator that
serializes pairing, upload commits, state changes, and quota checks. Set `PHONE_ENABLED=false` to
disable phone routes. This is independent of `SHARING_ENABLED`.

Phone and desktop credentials are separate. Only hashes are stored by the coordinator. Pairing links
expire after ten minutes and can be claimed by one phone. The encryption secret stays in the link's
fragment, the phone's browser storage, and the local helper's `.agentcut/phone-connection.json`.
Never log or publish this file or the complete link. Removing a connection revokes both credentials
and schedules deletion of its temporary objects.

R2 objects are under `phone/<connection>/<job>/`. Video parts and manifests use AES-GCM with random
nonces and job/object-bound authenticated data; input and output keys are derived separately. The
coordinator sees sizes, timestamps, and job stages, but not footage, filenames, or edit instructions.
Uploads cannot be changed after commit. Downloads require a device or single-result credential and are not
publicly cached. Inputs are deleted after local receipt; alarms delete remaining objects after three
days. Add a bucket lifecycle rule for `phone/` as a second cleanup mechanism:

```sh
npx wrangler r2 bucket lifecycle add agentcut-shares expire-phone phone/ --expire-days 3
# For the hosted production bucket, use vladsmedia instead. Preserve all existing rules.
```

Private result links use `/phone/watch` with credentials and a per-result decryption key in the URL
fragment. `POST /v1/phone/<device>/jobs/<job>/link` registers a stable capability derived by the phone;
the coordinator stores only its hash. `/v1/phone/<device>/results/<job>` accepts that capability for
metadata, encrypted result objects, and `POST .../delete`. It cannot access the inbox, source video,
other results, or device controls. The link never contains a device credential or pairing secret.
Deletion writes a tombstone before removing the R2 result objects; retries are safe and the helper
does not recreate deleted results. Expiry and connection revocation also disable result links.

Limits: 1 GB input and 1 GB result per job, 20 jobs and 3 GB of input reservations per connection
within three days. Connection creation uses `CREATE_LIMITER`; it is refused if that binding is absent.
Phone transfers require a Workers plan that supports SQLite Durable Objects and R2.

The site can use `NEXT_PUBLIC_PHONE_API_URL`, or fall back to `NEXT_PUBLIC_SHARE_API_URL`. Add its
origin to `ALLOWED_ORIGINS`. For local testing, run the Worker at port 8788 and set
`NEXT_PUBLIC_PHONE_API_URL=http://127.0.0.1:8788` before starting Next.js. A physical phone needs an
HTTPS site and relay that it can reach; a localhost address on a phone points to the phone itself.

Run `node --import tsx --test tests/phone.test.mjs` from the repository root for protocol, role,
cleanup, restart, and helper-transfer tests. The edit and render callbacks are test doubles; a real
agent/render test additionally requires a configured local agent and browser.

For a local browser and render smoke test, start the relay and site as above, then run
`node --import tsx tests/phone-smoke.mjs` from the repository root. It starts an isolated helper on
port 32120 and writes a temporary fixture file with a pairing link and a two-second test video.
Send that video from the phone page. The fixture replaces the coding agent with a one-second trim,
but uses the real Worker, background studio, and Remotion renderer. No paid agent request is sent.
Stop the fixture after testing. Its temporary workspace remains available for inspection.

For result-page checks only, run `node --import tsx tests/phone-result-smoke.mjs` with the same relay
and site configuration. It creates a one-second encrypted result and writes its private link to a
temporary fixture file. Check that opening the link fetches only metadata, Watch plays the video,
Download saves the same bytes, and Delete disables the link while preserving the local test file.

## Format

See the comment at the top of `packages/agentcut/src/studio/share.ts`: one stream of every file's bytes,
cut into 8 MB chunks (`shares/<id>/c/<n>`), each AES-256-GCM encrypted, plus an encrypted manifest
(`shares/<id>/manifest`) uploaded last, so a share only appears once it's complete.
