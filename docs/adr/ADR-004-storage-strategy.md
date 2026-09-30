# ADR-004: Storage strategy — local disk today, object storage behind an interface

**Status:** Accepted (with an explicit revisit trigger)
**Date:** 2026-09-30
**Deciders:** Core team

## Context

File uploads exist for entity photos and scanned documents
(`POST /api/upload`, ~5 MB ceiling, image MIME types only). The current
implementation writes to `public/uploads/`. The roadmap includes offline field
capture, which will eventually push much larger media (photos of diseased
plants, signed delivery notes) and the deployment target may move from a
single VM to ephemeral containers where the filesystem does not persist.

Constraints:

1. Team size < 5; no ops bandwidth for a storage cluster.
2. Ghana-based users: uploads must tolerate slow links (resumability matters
   more than raw speed).
3. Today's deployment is one Node process on one machine with ordinary
   filesystem backups.

## Decision

**Store uploads on local disk behind a narrow `FileStore` interface**, with
object storage (S3/R2/Supabase) as the planned second implementation.

```ts
// src/lib/storage.ts — the seam we commit to
export interface FileStore {
  put(key: string, data: Buffer, meta: { contentType: string }): Promise<{ url: string }>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
// v1: LocalDiskStore  →  public/uploads (randomized names, MIME allowlist)
// v2: S3CompatStore   →  R2/S3, same keys, CDN in front
```

Upload handling today (post-audit, SECURITY_AUDIT SEC-10):

- MIME allowlist (jpeg/png/webp/gif) and 5 MB cap checked before any write.
- Filename is **derived, never trusted**: `<entity>-<entityId>-<uuid8>.<ext>`
  where the extension comes from the validated MIME type, not the client name.
- Every upload is audit-logged with actor, target entity, and original name.

## Consequences

**Good:**

- Zero new infrastructure now; a container can run the app and its files.
- The interface makes the later migration a two-class change, not a hunt
  through call sites.
- Randomized names remove path traversal and overwrites by construction.

**Bad / accepted:**

- **Files don't survive horizontal scaling.** Two instances = split-brain
  uploads. Trigger below says when we must move.
- **`public/` is served statically by Next**, so a missed MIME check would be
  directly exploitable. Mitigated by allowlist + extension derivation; residual
  risk is content spoofing (a polyglot file) — magic-byte sniffing is P3 in the
  security backlog.
- Backups must include the uploads directory *and* the database consistently;
  documented in `docs/deployment.md`.

## Revisit trigger (explicit)

Move to object storage when **any** of these becomes true:

1. Second app instance (load balancer, blue/green) is deployed.
2. Upload volume exceeds ~10 GB or the backups become noticeably slow.
3. Offline field capture ships with photo attachments (expected P2 of roadmap).
4. A customer requires signed, expiring download links.

We expect trigger (3) within two roadmap cycles.

## Alternatives considered

| Option | Why rejected now |
|---|---|
| **S3/R2 from day one** | Right long-term answer, but adds credentials, bucket policies, multipart handling, and cost accounting before a single user has uploaded a photo. The interface lets us adopt it in a day when a trigger fires. |
| **Database (bytea/base64) storage** | Bloats backups and rows; no streaming; classic mistake at this scale. |
| **Vercel Blob / platform-locked storage** | Couples us to a deployment platform before we've chosen one. The `FileStore` seam keeps the option open. |
| **`fs` writes scattered at call sites** (status quo ante) | This is what we removed: any future storage change would have meant auditing every write path for filename handling too. |

## Notes

- Never store anything sensitive here: uploads are served to anyone with the
  URL. If we ever accept ID documents or contracts, that's a *new* ADR with
  signed-URL access control.
- The uploads directory is in `.gitignore`; local dev data is disposable by
  design.
