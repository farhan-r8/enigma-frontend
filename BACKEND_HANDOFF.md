# Frontend Handoff

## Current scope

Project ini sekarang difokuskan penuh ke `Enigma Protocol` versi frontend-only.
Semua flow utama bisa didemo tanpa backend:

- `/` untuk typing game utama
- `/enigma-protocol/lobby` untuk preview lobby
- `/enigma-protocol/room` untuk preview room
- `/enigma-protocol/leaderboard` untuk preview leaderboard
- `/enigma-protocol/profile` untuk preview profile

## Current gameplay engine

- 5 stage hardcoded
- typing word-by-word
- validasi case-sensitive
- pengumpulan huruf anomali
- end challenge password `SANDI`
- validasi IP target `198.51.100.77`
- jammer lokal dengan tombol `CTRL`
- audio feedback lokal via Web Audio API

## Recommended next backend integration

Kalau nanti mau disambungkan ke backend sungguhan, area yang paling siap diintegrasikan adalah:

### Leaderboard
- `GET /api/leaderboard`

### Agent profile
- `GET /api/agents/:codename`

### Result submit
- `POST /api/results`

### PvP / room sync
- `WS /ws` atau endpoint realtime lain yang setara
- frontend contract sekarang dipusatkan di [lib/enigma-room-contract.js](/D:/SEMESTER%204/webprog/UAS/frontend/lib/enigma-room-contract.js)

### Room state shape

Frontend dummy sekarang memakai snapshot room dengan bentuk ini:

```json
{
  "roomId": "PUB-104",
  "access": "public",
  "hostName": "Agent Raka",
  "operationId": "operation-sandi",
  "operationLabel": "Sector: West Logistics",
  "opponentMode": "local-network",
  "status": "waiting",
  "startedAt": null,
  "createdAt": 1740000000000,
  "lastActivityAt": 1740000005000,
  "resetVersion": 0,
  "players": [
    {
      "id": "host",
      "name": "Agent Raka",
      "role": "host",
      "clientId": "session-abcd1234"
    }
  ]
}
```

Catatan:
- `status` saat ini: `waiting`, `ready`, `in_progress`
- room public hanya tampil di lobby ketika status masih `waiting`
- room idle di lobby akan auto-delete setelah 10 menit
- jika host menutup tab/back/leave, room host langsung dihapus dari dummy store

### Realtime event shape

Frontend room PvP 2 tab saat ini sudah memakai event berikut:

```json
{
  "type": "PLAYER_JOINED | START | PROGRESS | MATCH_OVER",
  "occurredAt": 1740000005000,
  "...payload": "field sesuai event"
}
```

Payload aktif saat ini:

`PLAYER_JOINED`

```json
{
  "type": "PLAYER_JOINED",
  "occurredAt": 1740000005000,
  "senderId": "session-guest123",
  "playerName": "Agent Guest"
}
```

`START`

```json
{
  "type": "START",
  "occurredAt": 1740000005000,
  "senderId": "session-host123"
}
```

`PROGRESS`

```json
{
  "type": "PROGRESS",
  "occurredAt": 1740000005000,
  "senderId": "session-host123",
  "progress": 42
}
```

`MATCH_OVER`

```json
{
  "type": "MATCH_OVER",
  "occurredAt": 1740000005000,
  "senderId": "session-host123",
  "winnerId": "session-host123",
  "winnerName": "Agent Host",
  "localSummary": {
    "codename": "Agent Host",
    "result": "Success",
    "score": 4120,
    "wpm": 81
  },
  "rivalSummary": {
    "codename": "Agent Guest",
    "result": "Failed",
    "score": 3550,
    "wpm": 69
  }
}
```

### Suggested backend mapping

- `join_room`: backend validasi room, lalu kirim `room_state`
- `room_state`: kirim snapshot room penuh agar frontend tidak perlu meracik sendiri
- `progress_update`: payload bisa disamakan dengan `PROGRESS`
- `start_match`: bisa menggantikan `START`
- `match_over`: bisa disamakan dengan `MATCH_OVER`
- `leave_room`: backend yang menentukan apakah room dibubarkan atau guest saja yang keluar
- `reset_room`: backend menaikkan `resetVersion` agar frontend me-reset engine

### Frontend pieces ready to swap later

- [lib/enigma-room-store.js](/D:/SEMESTER%204/webprog/UAS/frontend/lib/enigma-room-store.js) saat ini hanya dummy localStorage, jadi nanti bisa diganti dengan adapter API/socket
- [components/enigma-protocol/EnigmaLobbyView.jsx](/D:/SEMESTER%204/webprog/UAS/frontend/components/enigma-protocol/EnigmaLobbyView.jsx) sudah cukup bersih untuk consume room list dari backend
- [components/enigma-protocol/EnigmaProtocolGame.jsx](/D:/SEMESTER%204/webprog/UAS/frontend/components/enigma-protocol/EnigmaProtocolGame.jsx) sudah memakai konstanta event, jadi migrasi BroadcastChannel ke WebSocket akan lebih mudah
- state gameplay inti masih lokal di `useStageTypingEngine`, jadi backend belum wajib mengontrol detail typing per kata kecuali memang ingin authoritative sync

Saat ini frontend tidak bergantung pada endpoint di atas, jadi integrasi backend bisa dilakukan bertahap tanpa memblokir demo lokal.
