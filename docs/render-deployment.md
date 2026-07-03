# Render Deployment

OfficePulse deploys to Render as a Docker-backed web service using `render.yaml`.

## Steps

1. Push this repository to GitHub.
2. In Render, create a new Blueprint from the repository.
3. Render will detect `render.yaml` at the repo root.
4. Fill every `sync: false` environment variable in the Render dashboard.
5. Deploy the `officepulse-api` service.

## Required Secret Values

- `DATABASE_URL`
- `DATABASE_DIRECT_URL`
- `REDIS_URL`
- `PLATFORM_PIN_HASH`
- `SESSION_COOKIE_SECRET`
- `INTERNAL_SERVICE_TOKEN`
- `TELEMETRY_HMAC_SECRET`

Optional integration values:

- Discord variables
- OpenAI variables

## Production PIN Hash

Do not deploy with `PLATFORM_DEV_PIN`. Generate and set an Argon2id hash:

```bash
bun -e 'console.log(await Bun.password.hash("123456", { algorithm: "argon2id" }))'
```

Use the output as `PLATFORM_PIN_HASH`, then choose a real PIN instead of `123456`.

## After Deploy

Run the health check:

```bash
curl https://<your-render-service>.onrender.com/health
```

Run migrations locally or from a one-off Render shell:

```bash
bun run db:migrate
```

