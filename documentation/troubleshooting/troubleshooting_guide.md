# Troubleshooting Guide & Bug Resolution Log

## 1. Overview
This document logs root cause analyses, debugging steps, common error patterns, and resolutions encountered during design, development, and testing of the WebRTC P2P Video Call App.

---

## 2. Common Failure Modes & Diagnostic Protocols

### 2.1 WebRTC Connection Failures (`ICE Connection Failed`)
- **Symptoms**: Signaling succeeds (offer/answer exchanged), but video/audio fails to display and `iceConnectionState` switches to `failed` or `disconnected`.
- **Diagnostic Steps**:
  1. Inspect browser console for ICE candidate gathering output.
  2. Verify STUN server resolution (`stun:stun.l.google.com:19302`).
  3. Check if either client is behind symmetric NAT or corporate firewall blocking UDP.
  4. Ensure TURN server credentials (`urls`, `username`, `credential`) are configured and reachable over TCP 443 / UDP 3478.

### 2.2 Media Access Denied (`NotAllowedError`)
- **Symptoms**: `navigator.mediaDevices.getUserMedia` throws `NotAllowedError`.
- **Diagnostic Steps**:
  1. Ensure app is served over HTTPS or localhost (WebRTC media devices require secure contexts).
  2. Check device camera/microphone permissions in browser settings.
  3. Verify no other application is holding exclusive lock on the camera device.

### 2.3 Signaling WebSocket Disconnections
- **Symptoms**: Call drops prematurely or ring state hangs without progress.
- **Diagnostic Steps**:
  1. Inspect WebSocket connection state (`ws.readyState`).
  2. Verify heartbeat/ping-pong mechanism on server to prevent Railway proxy timeout on idle connections.
  3. Check server logs for unauthorized token errors.

---

## 3. Incident & Bug Resolution Log

| Incident ID | Date | Category | Summary | Root Cause & Fix |
|---|---|---|---|---|
| **INC-001** | 2026-07-30 | Signaling / Auth | Colleague on Dashboard not receiving incoming call notification | **Root Cause**: QR code was mapped to mock user `user_mock_receiver_123`. Real Clerk user ID (`user_3HEK...`) had no mapping in `qr_code_receivers`. <br/>**Fix**: Auto-upsert Clerk hosts into `receivers` and `qr_code_receivers` on `/dashboard` load, and broadcast `incoming-call` events to `hosts:all` room. |
