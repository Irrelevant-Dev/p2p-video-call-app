# P2P Video Call App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a QR-initiated P2P WebRTC video calling app hosted on Railway with attached Railway PostgreSQL, Clerk authentication for receivers, and background Web Push notifications for incoming calls.

**Architecture:** A unified Next.js 14 (App Router) application serving frontend pages (QR scanner, receiver dashboard, WebRTC video room), API routes, and an integrated Socket.io signaling server. Receivers log in via Clerk and receive background Web Push alerts; guests scan QR codes without authenticating to initiate calls.

**Tech Stack:** Next.js 14, TypeScript, TailwindCSS, `@clerk/nextjs`, PostgreSQL, Drizzle ORM, Socket.io, WebRTC API, `web-push` (VAPID), Railway CLI, GitHub CLI (`gh`).

---

## Global Constraints
- **Framework**: Next.js 14+ with App Router & TypeScript.
- **Auth**: Clerk (`@clerk/nextjs`) for receiver identity.
- **Database**: PostgreSQL (Railway plugin) accessed via Drizzle ORM.
- **Hosting**: Deployed on Railway via Railway CLI.
- **Version Control**: Git repository pushed to GitHub under account `Irrelevant-Dev`.

---

## Task Decomposition

### Task 1: Repository Initialization & Railway/GitHub Provisioning

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Modify: `documentation/development/implementation_roadmap.md`

- [ ] **Step 1: Initialize Git repository locally**

```bash
git init
```

- [ ] **Step 2: Create remote GitHub repository via `gh` CLI**

```bash
gh repo create p2p-video-call-app --public --source=. --remote=origin
```

- [ ] **Step 3: Provision Railway Project & PostgreSQL Database**

```bash
railway init --name p2p-video-call-app
railway add --plugin postgresql
```

- [ ] **Step 4: Verify Railway link and fetch environment configuration**

```bash
railway status
```

- [ ] **Step 5: Commit task deliverables**

```bash
git add .
git commit -m "chore: initialize git repository and provision railway infrastructure"
```

---

### Task 2: Next.js Application Scaffolding & Clerk Auth Setup

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/middleware.ts`
- Modify: `.env.local`

- [ ] **Step 1: Scaffold Next.js project dependencies**

```bash
npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-install
npm install @clerk/nextjs drizzle-orm pg socket.io socket.io-client web-push html5-qrcode lucide-react
npm install -D drizzle-kit @types/pg @types/web-push dotenv
```

- [ ] **Step 2: Configure Clerk Middleware (`src/middleware.ts`)**

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher(['/', '/scan(.*)', '/call(.*)', '/api/qr(.*)', '/api/calls(.*)', '/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|png|jpg|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
};
```

- [ ] **Step 3: Wrap App with `ClerkProvider` in `src/app/layout.tsx`**

```tsx
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-slate-900 text-slate-100 min-h-screen">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 4: Commit task deliverables**

```bash
git add .
git commit -m "feat: scaffold next.js application with clerk authentication"
```

---

### Task 3: Database Schema & Drizzle ORM Setup

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/index.ts`
- Create: `drizzle.config.ts`
- Create: `src/db/seed.ts`

- [ ] **Step 1: Define Drizzle Schema (`src/db/schema.ts`)**

```typescript
import { pgTable, text, timestamp, uuid, pgEnum, jsonb, primaryKey } from 'drizzle-orm/pg-core';

export const callStatusEnum = pgEnum('call_status', ['pending', 'ringing', 'active', 'ended', 'declined', 'missed']);

export const receivers = pgTable('receivers', {
  clerkUserId: text('clerk_user_id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  pushSubscription: jsonb('push_subscription'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const qrCodes = pgTable('qr_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  label: text('label').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const qrCodeReceivers = pgTable('qr_code_receivers', {
  qrCodeId: uuid('qr_code_id').references(() => qrCodes.id, { onDelete: 'cascade' }).notNull(),
  receiverId: text('receiver_id').references(() => receivers.clerkUserId, { onDelete: 'cascade' }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.qrCodeId, t.receiverId] })
]);

export const callSessions = pgTable('call_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  qrCodeId: uuid('qr_code_id').references(() => qrCodes.id),
  guestName: text('guest_name').default('Guest Caller').notNull(),
  targetReceiverId: text('target_receiver_id').references(() => receivers.clerkUserId).notNull(),
  status: callStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
});
```

- [ ] **Step 2: Setup Database Client (`src/db/index.ts`)**

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

- [ ] **Step 3: Run Drizzle Schema Push to Railway PostgreSQL**

```bash
npx drizzle-kit push
```

- [ ] **Step 4: Commit task deliverables**

```bash
git add .
git commit -m "feat: define database schema and push migrations to postgres"
```

---

### Task 4: REST API Endpoints & Web Push Integration

**Files:**
- Create: `src/app/api/qr/[qrId]/receivers/route.ts`
- Create: `src/app/api/calls/route.ts`
- Create: `src/app/api/calls/[callId]/route.ts`
- Create: `src/app/api/receivers/push-subscription/route.ts`
- Create: `src/lib/push.ts`

- [ ] **Step 1: Implement Web Push helper (`src/lib/push.ts`)**

```typescript
import webpush from 'web-push';

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function sendWebPushNotification(subscription: any, payload: { title: string; body: string; url: string }) {
  if (!subscription) return false;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error('Web Push delivery error:', error);
    return false;
  }
}
```

- [ ] **Step 2: Build `GET /api/qr/[qrId]/receivers` route**
- [ ] **Step 3: Build `POST /api/calls` route (create session + send web push)**
- [ ] **Step 4: Build Push Subscription endpoint (`/api/receivers/push-subscription`)**
- [ ] **Step 5: Commit task deliverables**

```bash
git add .
git commit -m "feat: implement backend API routes and web push notification engine"
```

---

### Task 5: Socket.io Signaling Integration & Custom Server

**Files:**
- Create: `src/server.ts`
- Create: `src/lib/signaling.ts`

- [ ] **Step 1: Create custom HTTP + Socket.io Server (`src/server.ts`)**

Handles WebRTC signaling room channels (`join-room`, `offer`, `answer`, `ice-candidate`, `call:decline`, `call:end`).

- [ ] **Step 2: Commit task deliverables**

```bash
git add .
git commit -m "feat: implement custom node server with integrated socket.io webRTC signaling"
```

---

### Task 6: Frontend Pages (QR Scanner, Call Room, Receiver Dashboard)

**Files:**
- Create: `src/app/scan/page.tsx`
- Create: `src/app/scan/[qrId]/page.tsx`
- Create: `src/app/call/[callId]/page.tsx`
- Create: `src/app/dashboard/page.tsx`
- Create: `public/sw.js` (Service Worker for Web Push alerts)

- [ ] **Step 1: Build Service Worker (`public/sw.js`) for background push notifications**
- [ ] **Step 2: Build QR Scanner page (`/scan`) using `html5-qrcode`**
- [ ] **Step 3: Build Receiver Selection page (`/scan/[qrId]`)**
- [ ] **Step 4: Build WebRTC Video Call Component (`/call/[callId]`)**
  - Manages `RTCPeerConnection`, local camera feed, remote stream display, microphone/camera toggle, and call disconnect.
- [ ] **Step 5: Build Receiver Dashboard (`/dashboard`) with Clerk UserButton and Push Enable button**
- [ ] **Step 6: Commit task deliverables**

```bash
git add .
git commit -m "feat: build frontend scanner, receiver dashboard, service worker, and WebRTC video call components"
```

---

### Task 7: Deployment & Verification

- [ ] **Step 1: Set Railway Environment Variables**
- [ ] **Step 2: Deploy to Railway via CLI or GitHub Git Push**
- [ ] **Step 3: Verify end-to-end QR scan, Push Notification, and WebRTC P2P Call**

```bash
git push origin main
railway up
```
