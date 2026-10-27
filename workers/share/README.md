# Share links Worker

The Cloudflare Worker behind **Share** in the studio. The helper encrypts a project on the sender's
computer and uploads it here; the recipient's helper downloads and decrypts it. The key is only in the
link's `#fragment`, so this Worker and its R2 bucket only ever hold ciphertext.

It's stateless: limits are checked per request and signed into an upload token, nothing is stored but
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

## Develop

```sh
printf 'SIGNING_SECRET=dev-secret\nALLOWED_ORIGINS=http://localhost:3000\n' > .dev.vars
npx wrangler dev --port 8788
```

Then run the site with `NEXT_PUBLIC_SHARE_API_URL=http://127.0.0.1:8788`. The helper accepts `http://`
only for localhost.

## Format

See the comment at the top of `packages/agentcut/src/studio/share.ts`: one stream of every file's bytes,
cut into 8 MB chunks (`shares/<id>/c/<n>`), each AES-256-GCM encrypted, plus an encrypted manifest
(`shares/<id>/manifest`) uploaded last, so a share only appears once it's complete.
