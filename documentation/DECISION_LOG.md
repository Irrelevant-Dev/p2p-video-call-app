# Architectural & Design Decision Log

This document records key architectural, design, technical, and process decisions made throughout the lifecycle of the P2P Video Call App project.

---

## Decision Entries

### [DEC-001] Structured Documentation Standard
- **Date**: 2026-07-30
- **Status**: Accepted
- **Context**: The project requires strict tracking and organization for design, development, testing, and troubleshooting across all iterations.
- **Decision**: Adopt a centralized `documentation/` folder structure:
  - `documentation/design/` - Technical specifications, architecture, and data models.
  - `documentation/development/` - Feature specifications, implementation roadmaps, and execution tracking.
  - `documentation/testing/` - Test plans, WebRTC connection verification strategies, and automation logs.
  - `documentation/troubleshooting/` - Root cause analyses, WebRTC/NAT traversal issues, and bug resolution logs.
  - `documentation/DECISION_LOG.md` - Master record of design and technical decisions.
- **Consequences**: Ensures all feature work, bugs, and design changes remain documented and accessible for all future iterations.

---

### [DEC-002] WebRTC Peer-to-Peer Media Architecture with Railway Backend
- **Date**: 2026-07-30
- **Status**: Accepted
- **Context**: Video and audio media streams must scale cost-effectively without saturating backend server bandwidth.
- **Decision**: 
  - Backend handles identity, QR code lookup, call session management, and WebSocket signaling only.
  - Media streams flow directly peer-to-peer (P2P) between browsers via WebRTC (`RTCPeerConnection`).
  - Target hosting platform is Railway (Express/FastAPI backend, PostgreSQL database, optional Redis for multi-instance pub/sub).
- **Consequences**: High media scalability and low backend infrastructure costs. Requires STUN/TURN servers to handle NAT traversal and restrictive firewalls.
