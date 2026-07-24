# AQUATHRILL Thailand — Next.js

The complete browser UI is routed and rendered by the Next.js App Router. All
public, booking, agent, payment-result, and admin URLs are statically generated
through `app/[[...slug]]/page.tsx`, with per-page metadata and client lifecycle
handling for the existing interactive scripts.

## Development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Production

```bash
npm run build
npm start
```

Public assets and source page snapshots live under `public/legacy/`. API requests
are handled by `app/api/[endpoint]/route.ts`; the original `.php` suffix remains
supported for frontend and payment-provider compatibility. PostgreSQL access,
signed admin/agent sessions, Google Reviews, PaySolutions, and Vercel Blob uploads
now run in the Next.js Node runtime. Configure the variables in `.env.example` and
run `database/nextjs-migration.sql` once before deployment.
# aquathrill-v2
