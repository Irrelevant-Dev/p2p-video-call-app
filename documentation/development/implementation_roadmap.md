# P2P Video Call App Implementation Plan

> **Structured Documentation Tracking**: All task steps, architectural decisions, and production deployment parameters are fully documented below.

**Goal:** Build a QR-initiated P2P WebRTC video calling app hosted on Railway with attached Railway PostgreSQL, Clerk authentication for receivers, and background Web Push notifications for incoming calls.

**Architecture:** A unified Next.js 14 (App Router) application serving frontend pages (QR scanner, receiver dashboard with QR station cards & call history, WebRTC video room with real-time diagnostic console stream), API routes, and an integrated Socket.io signaling server. Receivers log in via Clerk and receive background Web Push + live socket ringing modal alerts; guests scan QR codes without authenticating to initiate calls.

**Tech Stack:** Next.js 14, TypeScript, TailwindCSS, `@clerk/nextjs`, PostgreSQL, Drizzle ORM, Socket.io, WebRTC API, `web-push` (VAPID), Railway CLI, GitHub CLI (`gh`).

---

## Global Constraints
- **Framework**: Next.js 14+ with App Router & TypeScript.
- **Auth**: Clerk (`@clerk/nextjs`) for receiver identity.
- **Database**: PostgreSQL (Railway plugin) accessed via Drizzle ORM.
- **Hosting**: Deployed on Railway (`https://web-production-fec50.up.railway.app`).
- **Version Control**: Git repository pushed to GitHub under account `Irrelevant-Dev/p2p-video-call-app`.

---

## Task Execution & Status

### Task 1: Repository Initialization & Railway/GitHub Provisioning
- [x] **Step 1: Initialize Git repository locally**
- [x] **Step 2: Create remote GitHub repository via `gh` CLI (`Irrelevant-Dev/p2p-video-call-app`)**
- [x] **Step 3: Provision Railway Project & PostgreSQL Database (`p2p-video-call-app`)**
- [x] **Step 4: Verify Railway link and environment configuration**
- [x] **Step 5: Commit task deliverables**

---

### Task 2: Next.js Application Scaffolding & Clerk Auth Setup
- [x] **Step 1: Scaffold Next.js project dependencies**
- [x] **Step 2: Configure Clerk Middleware (`src/middleware.ts`)**
- [x] **Step 3: Wrap App with `ClerkProvider` in `src/app/layout.tsx`**
- [x] **Step 4: Commit task deliverables**

---

### Task 3: Database Schema & Drizzle ORM Setup
- [x] **Step 1: Define Drizzle Schema (`src/db/schema.ts`) for `receivers`, `qrCodes`, `qrCodeReceivers`, `callSessions`**
- [x] **Step 2: Setup Database Client (`src/db/index.ts`)**
- [x] **Step 3: Run Drizzle Schema Push (`npm run db:push`) and Seed Script (`npm run db:seed`)**
- [x] **Step 4: Commit task deliverables**

---

### Task 4: REST API Endpoints & Web Push Integration
- [x] **Step 1: Implement Web Push helper (`src/lib/push.ts`)**
- [x] **Step 2: Build `GET /api/qr/[qrId]/receivers` route (auto-filtering mock receivers)**
- [x] **Step 3: Build `POST /api/calls` route (create session + send web push)**
- [x] **Step 4: Build Push Subscription endpoint (`/api/receivers/push-subscription`)**
- [x] **Step 5: Build Host Receiver Dashboard endpoint (`/api/receivers/dashboard`) with auto-upsert for Clerk hosts**

---

### Task 5: Socket.io Signaling Integration & Custom Server
- [x] **Step 1: Create custom HTTP + Socket.io Server (`src/server.ts` & `src/lib/signaling.ts`)**
- [x] **Step 2: Implement `hosts:all` room broadcasting & `room-ready` signaling triggers for SDP exchange**
- [x] **Step 3: Commit task deliverables**

---

### Task 6: Frontend Pages & Host Dashboard Redesign
- [x] **Step 1: Build Service Worker (`public/sw.js`) for background push notifications**
- [x] **Step 2: Build QR Scanner page (`/scan`) using `html5-qrcode`**
- [x] **Step 3: Build Receiver Selection page (`/scan/[qrId]`)**
- [x] **Step 4: Build WebRTC Video Call Component (`/call/[callId]`) with role-agnostic fail-safe signaling, ICE candidate queuing, and on-screen Real-Time Diagnostic Console Stream**
- [x] **Step 5: Redesign Host Dashboard (`/dashboard`) with Station QR code cards, QR Projection Modal, Copy/Test Call links, Live Incoming Ringing Modal, and Call History Log**

---

### Task 7: Railway Production Deployment & Verification
- [x] **Step 1: Link Railway GitHub source repo (`Irrelevant-Dev/p2p-video-call-app`)**
- [x] **Step 2: Set Railway Production Environment Variables (`DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, VAPID keys)**
- [x] **Step 3: Generate Production HTTPS Domain: `https://web-production-fec50.up.railway.app`**
- [x] **Step 4: Verify production build (`npm run build` passing 100%) and push all commits to GitHub `origin master`**
