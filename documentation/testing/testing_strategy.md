# Testing Strategy & Execution Guide

This guide details how to set up, run, and end-to-end test the QR P2P Video Call App locally and in production.

---

## 1. Prerequisites & Environment Setup

Before testing locally, configure your `.env.local` file with valid keys:

```bash
# 1. Copy template to .env.local
cp .env.example .env.local
```

Fill in `.env.local`:
1. **`DATABASE_URL`**: Your Railway PostgreSQL connection string (or local PostgreSQL `postgresql://postgres:postgres@localhost:5432/p2p_video`).
2. **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY`**: Obtain from your [Clerk Dashboard](https://dashboard.clerk.com).
3. **`NEXT_PUBLIC_VAPID_PUBLIC_KEY` & `VAPID_PRIVATE_KEY`**: Generate via CLI:
   ```bash
   npx web-push generate-vapid-keys
   ```

---

## 2. Database Schema & Data Seeding

Run the database setup commands to push table schemas and populate test data:

```bash
# 1. Push database tables to PostgreSQL
npm run db:push

# 2. Seed mock QR code and test receiver host into database
npm run db:seed
```

*Note down the generated QR Code ID output by `npm run db:seed` (e.g. `123e4567-e89b-12d3-a456-426614174000`).*

---

## 3. Starting Local Development Server

Start the custom Next.js + Socket.io server:

```bash
npm run dev
```

The application will be live at `http://localhost:3000`.

---

## 4. End-to-End Test Execution Flows

### Flow 1: Host Receiver Login & Push Setup
1. Open Chrome/Firefox and navigate to `http://localhost:3000/dashboard`.
2. Sign in via Clerk.
3. On the Host Dashboard, click **Enable Push Alerts** to grant browser notification permissions.

### Flow 2: Guest QR Code Scan & Call Placement
1. Open an Incognito window or second browser tab.
2. Navigate directly to `http://localhost:3000/scan/<qrCodeId>` (replace `<qrCodeId>` with the UUID from `npm run db:seed`, or test camera scanning at `http://localhost:3000/scan`).
3. View the available host recipient ("Front Desk Host").
4. Enter an optional guest name (e.g., "Visitor John") and click **Call**.

### Flow 3: WebRTC Video Call Session
1. The guest browser redirects to `/call/<callId>?role=guest`.
2. The host receives a browser push notification or opens `/call/<callId>?role=host`.
3. Allow camera/microphone access in both browser windows.
4. **Verify**:
   - Both local and remote video streams render in real time.
   - Microphone toggle (Mute/Unmute) functions on both sides.
   - Camera toggle (On/Off) updates local PiP and remote feed.
   - Clicking **End Call** closes the peer connection and returns users to the homepage/dashboard.

---

## 5. Automated Verification Commands

To verify TypeScript types and production build integrity at any time:

```bash
npm run build
```
