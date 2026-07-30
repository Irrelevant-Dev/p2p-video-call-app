# QR-Initiated Peer-to-Peer Video Call App — Design Specification

## 1. Overview

A web application that lets a user scan a QR code, view a list of user(s) associated
with that QR code, select one, and initiate a direct browser-to-browser (WebRTC)
video call with them. The backend's only responsibility is session/user lookup and
WebRTC signaling — it never touches media streams.

**Hosting target:** Railway (backend service + Postgres + optional Redis)

---

## 2. High-Level Architecture

```
┌─────────────┐        HTTPS (REST)         ┌──────────────────────┐
│  Client A   │ ───────────────────────────▶│   Backend (Railway)  │
│ (Scanner)   │                              │  - Express/FastAPI   │
└─────────────┘                              │  - Postgres          │
      │                                      │  - WebSocket signal  │
      │ WebSocket (signaling only)           └──────────────────────┘
      │                                                 ▲
      ▼                                                 │ WebSocket
┌─────────────┐        WebRTC (P2P media)     ┌─────────────┐
│  Client A   │◀──────────────────────────────▶│  Client B   │
│  (Browser)  │      Direct video/audio         │  (Browser)  │
└─────────────┘                                └─────────────┘
```

Key principle: **REST/DB for identity and lookup, WebSocket for signaling only,
WebRTC for the actual call.** No media ever passes through the backend under
normal (STUN-resolvable) network conditions.

---

## 3. Core User Flow

1. User A opens the web app and scans a QR code (client-side, camera access).
2. The QR code encodes a short identifier, e.g. `https://app.example.com/scan/{qrId}`.
3. Client calls `GET /api/qr/{qrId}/users` → backend returns the list of users
   associated with that QR code.
4. User A selects a user (User B) from the returned list.
5. Client calls `POST /api/calls` to create a call session, receiving a `callId`
   and a signaling room to join.
6. Client A opens a WebSocket connection to the signaling server and joins the
   room for `callId`.
7. Backend notifies User B (via push/WebSocket/existing session, depending on
   how B is expected to be reachable — see §6.4 open question) that a call is
   incoming.
8. User B accepts → both clients exchange SDP offer/answer and ICE candidates
   via the signaling WebSocket.
9. WebRTC `RTCPeerConnection` established directly between browsers.
10. Video/audio streams flow peer-to-peer. Signaling WebSocket may remain open
    for renegotiation, mute state, or call-end events.
11. Either party ends the call → both peer connections and the signaling room
    are torn down.

---

## 4. Data Model

### `users`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| display_name | text | |
| avatar_url | text (nullable) | |
| created_at | timestamptz | |

### `qr_codes`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | encoded in the QR image as part of the URL |
| label | text (nullable) | e.g. "Front Desk", "Room 4" |
| created_at | timestamptz | |

### `qr_code_users` (join table)
| Field | Type | Notes |
|---|---|---|
| qr_code_id | UUID (FK → qr_codes.id) | |
| user_id | UUID (FK → users.id) | |

### `calls`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | also used as signaling room name |
| initiator_user_id | UUID (nullable — scanning party may be anonymous) | |
| target_user_id | UUID (FK → users.id) | |
| qr_code_id | UUID (FK → qr_codes.id) | |
| status | enum: `pending`, `ringing`, `active`, `ended`, `declined`, `missed` | |
| created_at | timestamptz | |
| started_at | timestamptz (nullable) | |
| ended_at | timestamptz (nullable) | |

> Note: decide whether the scanning user needs an account at all, or is
> anonymous/session-based. This materially affects whether `initiator_user_id`
> is nullable and whether auth is required before scanning.

---

## 5. REST API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/qr/:qrId/users` | Returns users associated with a QR code |
| POST | `/api/calls` | Creates a call session `{ qrId, targetUserId }` → returns `{ callId, signalingUrl }` |
| GET | `/api/calls/:callId` | Fetch call status |
| POST | `/api/calls/:callId/end` | Mark call ended, cleanup |
| GET | `/api/users/:userId` | Basic profile info (name, avatar) for display in-call |

All endpoints should validate that the requested QR code / user relationship
actually exists before returning data — do not trust client-supplied IDs blindly
(see §8 Security).

---

## 6. Signaling Server (WebSocket)

### 6.1 Responsibilities
- Room management: each `callId` is a room with exactly 2 participants.
- Relay SDP offer/answer and ICE candidates between the two participants.
- Relay simple control messages: `call:ring`, `call:accept`, `call:decline`,
  `call:end`, `peer:mute`, `peer:disconnect`.
- Nothing else. It must never see or touch media.

### 6.2 Suggested message envelope
```json
{
  "type": "offer" | "answer" | "ice-candidate" | "call:accept" | "call:decline" | "call:end",
  "callId": "uuid",
  "payload": { }
}
```

### 6.3 Scaling consideration
If you expect to run more than one backend instance on Railway, a plain
in-memory room map won't work across instances. Options:
- Pin to a single instance (fine for low/moderate traffic — Railway supports this).
- Use Redis pub/sub to broadcast signaling messages across instances if you
  need horizontal scaling.

### 6.4 Open design question — how is the target user notified?
This needs a decision before implementation:
- **Option A (both parties present in-app):** Target user has the app open
  and is already connected via WebSocket (e.g. logged in, listening for
  incoming calls). Backend pushes `call:ring` directly.
- **Option B (target user not necessarily online):** Need a notification
  channel — web push notification, SMS, or email with a join link — to alert
  them a call is incoming, then they open the app and connect.

Confirm which model applies (e.g. is this for a reception/intercom-style use
case where the target is a manned kiosk, or a general contact-list calling app?)
before building the signaling flow.

---

## 7. WebRTC Client Implementation Notes

### 7.1 ICE servers
```js
const iceServers = [
  { urls: "stun:stun.l.google.com:19302" }, // free STUN, resolves ~80-90% of connections
  {
    urls: "turn:your-turn-server:3478",
    username: "...",
    credential: "..."
  } // required fallback for symmetric NAT / restrictive firewalls
];
```
- STUN alone will not work for all users. Budget for a TURN provider (Twilio
  Network Traversal Service, Cloudflare Calls TURN, or self-hosted `coturn`)
  before going to production. Without TURN, some percentage of calls (varies
  by user base, often 10-20%) will simply fail to connect.

### 7.2 Core client flow (pseudocode)
```js
const pc = new RTCPeerConnection({ iceServers });

// Get local media
const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

// Handle remote stream
pc.ontrack = (event) => { remoteVideoEl.srcObject = event.streams[0]; };

// ICE candidate exchange
pc.onicecandidate = (event) => {
  if (event.candidate) ws.send(JSON.stringify({ type: "ice-candidate", callId, payload: event.candidate }));
};

// Caller: create and send offer
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
ws.send(JSON.stringify({ type: "offer", callId, payload: offer }));

// Callee: on receiving offer
await pc.setRemoteDescription(offer);
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
ws.send(JSON.stringify({ type: "answer", callId, payload: answer }));

// Both sides: on receiving ICE candidate
await pc.addIceCandidate(candidate);
```

### 7.3 QR scanning
- Use `html5-qrcode` or `zxing-js` — both run entirely client-side using the
  device camera via `getUserMedia`.
- Camera permission prompts happen twice conceptually (once for QR scan, once
  for the video call itself) — consider UX messaging so users aren't confused
  by repeated permission requests.

---

## 8. Security Considerations

- **QR ID enumeration**: QR IDs should be non-sequential (UUIDs), not
  incrementing integers, to prevent scanning-by-guessing.
- **Authorization on lookup**: `/api/qr/:qrId/users` should not leak data for
  invalid/unknown QR IDs beyond a generic 404.
- **Call room access control**: the signaling server must verify that a
  connecting WebSocket client is actually a legitimate participant in that
  `callId` (e.g. via a short-lived signed token issued when the call is
  created) — don't let arbitrary clients join any room by guessing a `callId`.
- **HTTPS/WSS only**: WebRTC's `getUserMedia` requires a secure context in
  production; Railway provides HTTPS by default, ensure WebSocket runs as `wss://`.
- **Rate limiting**: on call creation and QR lookup endpoints to prevent abuse.

---

## 9. Suggested Tech Stack

| Layer | Suggestion | Notes |
|---|---|---|
| Frontend | React (or plain JS) | `html5-qrcode` for scanning |
| Backend | Node.js + Express, or FastAPI | Same process can serve REST + WebSocket, or split into two Railway services |
| Signaling | `ws` or `socket.io` | socket.io gives reconnection/room helpers for free |
| Database | Postgres (Railway managed) | |
| Cross-instance signaling (if needed) | Redis (Railway managed) | Only needed if scaling beyond 1 backend instance |
| TURN | Twilio NTS / Cloudflare Calls / self-hosted coturn | Required for production reliability |

---

## 10. Deployment on Railway

- One Railway service for the backend (REST + WebSocket, can share a port).
- One Railway Postgres plugin.
- Optional Railway Redis plugin if scaling signaling across instances.
- Frontend can be a static build served from the same backend service, or a
  separate static hosting target (e.g. also on Railway, or Vercel/Netlify) —
  decide based on whether you want a single deployable unit.
- Environment variables to configure: `DATABASE_URL`, `TURN_URL`,
  `TURN_USERNAME`, `TURN_CREDENTIAL`, `SIGNALING_TOKEN_SECRET`.

---

## 11. Open Questions to Resolve Before Build

1. Does the scanning user need to authenticate, or is scanning anonymous?
2. How is the target user notified of an incoming call (§6.4)? This is the
   single biggest undetermined design decision.
3. Can a QR code be associated with multiple users, and if the scanner picks
   one, do the others get notified they were "not selected," or nothing?
4. What happens if the target user is already in another call?
5. Is call history/logging required (who called whom, duration, etc.) beyond
   the `calls` table's basic status tracking?
6. Any requirement for screen sharing, chat, or is this strictly 1:1 audio/video?
