# QR-Initiated Peer-to-Peer Video Call App — System Architecture & Technical Design

## 1. Executive Summary & Core Requirements

The application is a web-based, QR-initiated peer-to-peer (P2P) video calling platform.
- **One-time Callers (Scanners)**: Unauthenticated guest users scanning a QR code with a mobile or desktop camera. They select an intended recipient from the QR code's mapped users and initiate a call without creating an account.
- **Receivers (Hosts/Agents)**: Authenticated users managed via **Clerk**. Receivers receive background **Web Push** notifications or direct join alerts when an incoming call is placed, allowing them to instantly answer and join the call.
- **Media Engine**: WebRTC (`RTCPeerConnection`) for direct peer-to-peer video/audio. The backend server never handles or proxies media streams.
- **Infrastructure**: Hosted on **Railway** as a unified Next.js + Socket.io server with attached **Railway PostgreSQL** database.

---

## 2. Tech Stack & Infrastructure

| Layer | Component / Tool | Details |
|---|---|---|
| **Framework** | Next.js 14+ (App Router) | Unified React frontend, API routes, and Socket.io server |
| **Authentication** | Clerk (`@clerk/nextjs`) | Authentication for receivers/hosts |
| **Database** | PostgreSQL (Railway Managed) | Database storage using Drizzle ORM |
| **Signaling** | Socket.io | Real-time WebSocket signaling room per call session |
| **Notifications** | Web Push (VAPID API / Service Worker) | Background push notification to offline receivers |
| **P2P Media** | WebRTC Native APIs | Browser-to-browser direct video/audio with STUN/TURN fallback |
| **Hosting Platform** | Railway | Unified service + attached PostgreSQL database plugin |
| **Source Control** | Git + GitHub | Repository created on GitHub (`Irrelevant-Dev`) |

---

## 3. System Architecture

```
┌─────────────────────────┐         HTTPS / REST API           ┌─────────────────────────────────────┐
│   One-Time Caller       │ ──────────────────────────────────▶│          Railway Service            │
│  (Unauthenticated)      │                                    │  - Next.js Frontend & API Routes   │
└─────────────────────────┘                                    │  - Socket.io Signaling Server       │
             │                                                 │  - Clerk Auth SDK                   │
             │ Socket.io (Signaling Room)                      └─────────────────────────────────────┘
             │                                                                   │
             ▼                                                                   ▼
┌─────────────────────────┐           WebRTC P2P Media                 ┌─────────────────────────────────────┐
│   One-Time Caller       │◀──────────────────────────────────────────────▶│          Railway PostgreSQL         │
│   (Browser Media)       │        Direct Video / Audio                └─────────────────────────────────────┘
└─────────────────────────┘                                                      ▲
                                                                                 │ DB Query / VAPID Push
                                    Socket.io & Web Push Notification            │
                                ┌────────────────────────────────────────────────┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │     Clerk Receiver      │
                   │    (Authenticated)      │
                   └─────────────────────────┘
```

---

## 4. Database Schema (PostgreSQL)

### 4.1 `receivers` Table
Stores authenticated receiver profiles synced from Clerk.

```sql
CREATE TABLE receivers (
    clerk_user_id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    push_subscription JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.2 `qr_codes` Table
Defines QR code entities.

```sql
CREATE TABLE qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.3 `qr_code_receivers` Table
Join table mapping QR codes to one or more Clerk receivers.

```sql
CREATE TABLE qr_code_receivers (
    qr_code_id UUID REFERENCES qr_codes(id) ON DELETE CASCADE,
    receiver_id VARCHAR(255) REFERENCES receivers(clerk_user_id) ON DELETE CASCADE,
    PRIMARY KEY (qr_code_id, receiver_id)
);
```

### 4.4 `call_sessions` Table
Tracks call room state, timestamps, and history.

```sql
CREATE TYPE call_status AS ENUM ('pending', 'ringing', 'active', 'ended', 'declined', 'missed');

CREATE TABLE call_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_code_id UUID REFERENCES qr_codes(id),
    guest_name VARCHAR(255) DEFAULT 'Guest Caller',
    target_receiver_id VARCHAR(255) REFERENCES receivers(clerk_user_id),
    status call_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
);
```

---

## 5. End-to-End User Flow & Signaling Architecture

1. **QR Code Scanning**:
   - Guest opens camera scanner at `/scan`.
   - QR code yields URL `https://<domain>/scan/<qrId>`.
2. **Receiver Selection**:
   - Guest browser queries `GET /api/qr/<qrId>/receivers`.
   - Server returns list of associated Clerk receivers (`display_name`, `avatar_url`).
3. **Call Session Creation & Notification**:
   - Guest selects target receiver (e.g. "Front Desk Host") and submits `POST /api/calls`.
   - Backend inserts record into `call_sessions` (`status = 'pending'`), generates room `callId`.
   - Backend sends Web Push notification via VAPID to `target_receiver_id`'s `push_subscription`.
4. **Receiver Joining Call**:
   - Host receives browser Web Push notification ("Incoming Video Call from Guest").
   - Host clicks notification → navigates directly to `/call/<callId>`.
5. **WebRTC P2P Session**:
   - Both Guest and Host connect to Socket.io signaling room `call:<callId>`.
   - Exchange WebRTC SDP Offer, SDP Answer, and ICE Candidates.
   - Browser `RTCPeerConnection` established. Video and audio stream directly between peers.
6. **Teardown**:
   - Either party clicks "End Call" → socket emits `call:end` → room torn down and DB status set to `ended`.

---

## 6. Environment Configuration & Security

### Required Environment Variables
- `DATABASE_URL`: PostgreSQL connection string provided by Railway.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk public API key.
- `CLERK_SECRET_KEY`: Clerk private API key.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: Web Push VAPID public key.
- `VAPID_PRIVATE_KEY`: Web Push VAPID private key.
- `VAPID_SUBJECT`: `mailto:admin@example.com` for Web Push header.

### Security Controls
- **Signaling Token**: WebSockets require a signed short-lived JWT token generated on `/api/calls` to join a `callId` room.
- **HTTPS & WSS Enforcement**: WebRTC `getUserMedia` requires secure contexts (`https://` and `wss://` on Railway).
