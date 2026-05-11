export const ENIGMA_NAV_ITEMS = [
  { href: '/enigma-protocol/lobby', label: 'Lobby', key: 'lobby' },
  { href: '/enigma-protocol/leaderboard', label: 'Leaderboard', key: 'leaderboard' },
  { href: '/enigma-protocol/profile', label: 'Profile', key: 'profile' },
];

export const ENIGMA_OPERATIONS = [
  {
    id: 'sandi',
    title: 'Operation SANDI',
    codename: 'SANDI',
    targetIp: '198.51.100.77',
    theme: 'Korupsi & Sabotase Internal',
    levels: [
      {
        english:
          'The logistics movement in the western sector detected an anomaly. The primary reSponse team was deployed to the secondary warehouse. We need to verify the raw logs immediately.',
        anomaly: 'S',
      },
      {
        english:
          'Communication units intercepted encrypted packets from a private network. Initial data anAlysis shows hidden digital transactions. The routing locations shift dynamically every ten minutes.',
        anomaly: 'A',
      },
      {
        english:
          'Significant structural changes detected via automated monitoring. An unknown entity attempted to coNnect to our sleeping nodes. Traffic surged beyond standard operational hours.',
        anomaly: 'N',
      },
      {
        english:
          'The latest financial audit revealed severe discrepancies in the monthly transaction logs. Illicit funds are flowing unDer multiple offshore accounts. We must trace the final destination.',
        anomaly: 'D',
      },
      {
        english:
          'Personnel movement outside authorized zones has been flagged. Multiple subjects remain actIve in the restricted basement area. Biometric sensors have been remotely compromised.',
        anomaly: 'I',
      },
    ],
    secretReport:
      '[ DECLASSIFIED: MASTER RECORD ] Berdasarkan kompilasi data dari lima sektor, kami mengonfirmasi adanya sindikat internal tingkat tinggi yang mendalangi manipulasi logistik, komunikasi, dan finansial agensi. Seluruh aliran dana gelap dan akses kontrol biometrik saat ini berpusat dan dikendalikan dari sebuah command center eksternal. Untuk menetralisir ancaman, membekukan aset, dan mengunci sistem musuh secara permanen, segera transmisikan paket override protocol ke server utama mereka melalui alamat IP 198.51.100.77. Lakukan otorisasi dengan cepat sebelum mereka memutuskan koneksi.',
  },
  {
    id: 'virus',
    title: 'Operation VIRUS',
    codename: 'VIRUS',
    targetIp: '10.250.44.12',
    theme: 'Serangan Siber & Ransomware',
    levels: [
      {
        english:
          'The main firewall has detected a critical vulnerability. An external probe is scanning the serVer ports. We must patch the exploit immediately before data leaks.',
        anomaly: 'V',
      },
      {
        english:
          'Unauthorized data extraction is happening in the core facIlity. Massive amounts of encrypted files are being transferred out. Halt the outbound traffic now.',
        anomaly: 'I',
      },
      {
        english:
          'A foreign script is attempting to hijack the main opeRation. The malware payload is currently dormant but highly unstable. Isolate the affected subnet.',
        anomaly: 'R',
      },
      {
        english:
          'Security protocols have been bypassed using a secUre backdoor. The intruder has gained administrative privileges. Revoke all access tokens instantly.',
        anomaly: 'U',
      },
      {
        english:
          'The entire cooling syStem is being overridden remotely. Hardware failure is imminent if we do not act fast. Initiate the emergency manual lockdown.',
        anomaly: 'S',
      },
    ],
    secretReport:
      '[ DECLASSIFIED: MASTER RECORD ] Analisis forensik mengonfirmasi bahwa infrastruktur utama kita telah disusupi oleh ransomware tingkat militer. Malware ini dijadwalkan untuk menghapus seluruh arsip intelijen dan menghancurkan pendingin perangkat keras dalam hitungan menit. Untuk menetralisir ancaman ini, kirimkan kill-switch code ke server komando musuh yang mengendalikan skrip tersebut melalui alamat IP 10.250.44.12. Segera eksekusi sebelum sistem kita hancur sepenuhnya.',
  },
  {
    id: 'agent',
    title: 'Operation AGENT',
    codename: 'AGENT',
    targetIp: '172.16.200.50',
    theme: 'Agen Ganda & Pencurian Cetak Biru',
    levels: [
      {
        english:
          'Visual surveillance confirmed that the primary tArget left the safehouse. The individual was carrying a classified briefcase. Follow the suspect discreetly.',
        anomaly: 'A',
      },
      {
        english:
          'Audio interception picked up a strange radio siGnal. The transmission contains coordinates for a covert rendezvous. Decode the frequency quickly.',
        anomaly: 'G',
      },
      {
        english:
          'Restricted blueprints were accessed using a stolen viEw clearance. The mole has downloaded the stealth drone schematics. Lock down the archive room.',
        anomaly: 'E',
      },
      {
        english:
          'Our undercover operative has been compromised by a rogue ageNt. Their true identity is no longer protected in the field. Extract our personnel immediately.',
        anomaly: 'N',
      },
      {
        english:
          'The suspect is heading towards the extraction rouTe at the border. An unidentified helicopter is waiting for pickup. Deploy the interception squad now.',
        anomaly: 'T',
      },
    ],
    secretReport:
      '[ DECLASSIFIED: MASTER RECORD ] Operasi kontra-intelijen kami membuahkan hasil. Kami telah mengidentifikasi agen ganda di dalam jajaran eksekutif yang membocorkan cetak biru senjata rahasia dan mengorbankan personel penyamar kita. Data cetak biru tersebut saat ini sedang ditransmisikan secara langsung ke drop-server milik sindikat asing. Hentikan transmisi tersebut dan blokir akses jaringan eksternal dengan melumpuhkan titik routing utama mereka di IP 172.16.200.50. Lakukan sekarang sebelum rahasia negara jatuh ke tangan musuh.',
  },
];

export const ENIGMA_ROOMS = [
  { code: 'SND-771', operation: 'SANDI', host: 'Agent Raka', players: 2, status: 'Ready' },
  { code: 'VRS-440', operation: 'VIRUS', host: 'Agent Naya', players: 1, status: 'Waiting' },
  { code: 'AGT-502', operation: 'AGENT', host: 'Agent Mira', players: 2, status: 'Live' },
];

export const ENIGMA_LEADERBOARD = [
  { rank: 1, codename: 'Agent Mira', operation: 'AGENT', score: 4880, accuracy: 99, wpm: 92 },
  { rank: 2, codename: 'Agent Raka', operation: 'SANDI', score: 4625, accuracy: 97, wpm: 88 },
  { rank: 3, codename: 'Agent Naya', operation: 'VIRUS', score: 4510, accuracy: 96, wpm: 83 },
  { rank: 4, codename: 'Agent Farhan', operation: 'SANDI', score: 4395, accuracy: 95, wpm: 80 },
  { rank: 5, codename: 'Agent Dion', operation: 'AGENT', score: 4210, accuracy: 93, wpm: 76 },
];

export const ENIGMA_RECENT_OPS = [
  {
    name: 'Operation: West Logistics',
    result: 'Success',
    score: 4395,
    note: 'Status: Master File Decrypted',
  },
  {
    name: 'Operation: Core Server',
    result: 'Partial',
    score: 3910,
    note: 'Decryption Key: [REDACTED]',
  },
  {
    name: 'Operation: Border Route',
    result: 'Success',
    score: 4488,
    note: 'Status: Master File Decrypted',
  },
];

export const ENIGMA_ROOM_PLAYERS = [
  { name: 'Agent Farhan', status: 'Ready', progress: 72 },
  { name: 'Agent Mira', status: 'Ready', progress: 68 },
];
