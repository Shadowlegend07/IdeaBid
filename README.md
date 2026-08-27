# StoryVerse

StoryVerse is a production-oriented social reading and audio-story platform for iOS and Android.

## Structure

- `apps/mobile` — Expo/React Native client with a polished reader-first experience
- `apps/api` — NestJS REST API with JWT auth, RBAC, Swagger, Prisma and Redis hooks
- `infra` — Docker development services and deployment templates
- `.github/workflows` — CI pipeline

## Start locally

1. `cp .env.example .env`
2. `docker compose up -d postgres redis minio`
3. `npm install`
4. `npm run db:generate && npm run db:migrate`
5. `npm run dev:api` and `npm run dev:mobile`

Open the Expo QR code in Expo Go, or run an iOS/Android simulator. API docs are at `http://localhost:4000/docs`.

### iPhone preview

Keep the Metro process open while using Expo Go. Start with `npm run dev:mobile -- --tunnel` if the phone cannot open a LAN QR code (different Wi-Fi, guest Wi-Fi, VPN, or Windows firewall). A LAN QR code requires the computer and phone to be on the same non-guest Wi-Fi and may require granting Node.js access through Windows Defender Firewall.

## Android testing and Play Store release

The mobile client is configured for Expo SDK 54 / Expo Go 54. Use `npm run dev:mobile:tunnel` for an Expo Go QR code on a device. To make an installable APK for testers, log in to Expo and run `npm run build:android:preview`. For Google Play, run `npm run build:android:production`; this produces an `.aab` App Bundle, the format required by Google Play. Configure the Expo project with `npx eas-cli@latest login` and `npx eas-cli@latest init` before the first cloud build, then upload the AAB to the Play Console Internal testing track.

If the initial SDK 54 install is interrupted by a network timeout, retry `npm install --no-audit --no-fund` from the repository root. The included `.npmrc` increases npm's fetch timeout and retry policy for unreliable connections.

### Expo Go recovery

If Expo Go reports `Failed to download remote update`, force-close Expo Go, clear its Android app storage, then run `npm run dev:mobile:tunnel -- --clear --go` and scan only the newly displayed QR code. `runtimeVersion` is intentionally omitted from the Expo Go configuration because it belongs to EAS builds, not local Expo Go sessions.

If the Expo tunnel times out, use `npm run dev:mobile:lan -- --clear --go` instead. Both the Android phone and computer must use the same normal Wi-Fi network (not guest Wi-Fi), and Windows Defender Firewall must allow `node.exe` on private networks.

The repository also includes a root Expo entrypoint, so `npx expo start --clear` from the repository root and the mobile launch scripts both load the same StoryVerse application.

## Security and operations

Access tokens are short lived; refresh tokens are hashed and rotated. The API applies RBAC, request validation, rate limits, structured logging and a global error boundary. Object storage uses presigned S3-compatible URLs. The included Docker Compose setup is for local development; production should use managed Postgres, Redis, S3, a secret manager, TLS ingress and centralized logs/metrics.

## Web deployment

The Vercel project should deploy from the repository root. `vercel.json` routes the root request to the static frontend in `web/`. Redeploy the latest `master` commit after connecting the repository.

Deploy the NestJS API separately using `api/Dockerfile` with the repository root as the Docker build context. Configure `DATABASE_URL`, `REDIS_URL`, `WEB_ORIGIN`, the JWT secrets, and the Dodo Payments variables on the API service. Set `window.IDEABID_API_URL` in the web deployment to the public API URL before loading `web/app.js`.
