function alignTranslatedWords(englishWords, translatedParagraph) {
  const translatedWords = translatedParagraph.replaceAll('.', '').split(' ');

  return englishWords.map((_, index) => {
    if (translatedWords[index]) {
      return translatedWords[index];
    }

    return translatedWords[translatedWords.length - 1] || '';
  });
}

function createStage(id, title, anomalyKey, englishParagraph, translatedParagraph) {
  const englishWords = englishParagraph.replaceAll('.', '').split(' ');

  return {
    id,
    title,
    anomalyKey,
    englishParagraph,
    englishWords,
    translatedWords: alignTranslatedWords(englishWords, translatedParagraph),
  };
}

export const enigmaOperations = [
  {
    id: 'operation-sandi',
    codename: 'SANDI',
    alias: 'Sector: West Logistics',
    title: 'Operation 1: SANDI',
    theme: 'Korupsi & Sabotase Internal',
    targetIp: '198.51.100.77',
    masterFile:
      '[ DECLASSIFIED: MASTER RECORD ] Berdasarkan kompilasi data dari lima sektor, kami mengonfirmasi adanya sindikat internal tingkat tinggi yang mendalangi manipulasi logistik, komunikasi, dan finansial agensi. Seluruh aliran dana gelap dan akses kontrol biometrik saat ini berpusat dan dikendalikan dari sebuah command center eksternal. Untuk menetralisir ancaman, membekukan aset, dan mengunci sistem musuh secara permanen, segera transmisikan paket override protocol ke server utama mereka melalui alamat IP 198.51.100.77 Lakukan otorisasi dengan cepat sebelum mereka memutuskan koneksi',
    stages: [
      createStage(
        'sandi-stage-1',
        "Stage 1 - Key 'S'",
        'S',
        'the logistics movement in the western sector detected an anomaly. the primary reSponse team was deployed to the secondary warehouse. we need to verify the raw logs immediately.',
        'pergerakan logistik di sektor barat mendeteksi anomali. tim respons utama dikerahkan ke gudang sekunder. kita perlu memverifikasi log mentah segera.',
      ),
      createStage(
        'sandi-stage-2',
        "Stage 2 - Key 'A'",
        'A',
        'communication units intercepted encrypted packets from a private network. initial data anAlysis shows hidden digital transactions. the routing locations shift dynamically every ten minutes.',
        'unit komunikasi mencegat paket terenkripsi dari jaringan privat. analisis data awal menunjukkan transaksi digital tersembunyi. lokasi perutean bergeser dinamis setiap sepuluh menit.',
      ),
      createStage(
        'sandi-stage-3',
        "Stage 3 - Key 'N'",
        'N',
        'significant structural changes detected via automated monitoring. an unknown entity attempted to coNnect to our sleeping nodes. traffic surged beyond standard operational hours.',
        'perubahan struktural signifikan terdeteksi melalui pemantauan otomatis. entitas tak dikenal mencoba terhubung ke node tidur kami. trafik melonjak melewati jam operasional standar.',
      ),
      createStage(
        'sandi-stage-4',
        "Stage 4 - Key 'D'",
        'D',
        'the latest financial audit revealed severe discrepancies in the monthly transaction logs. illicit funds are flowing unDer multiple offshore accounts. we must trace the final destination.',
        'audit keuangan terbaru mengungkap selisih besar dalam log transaksi bulanan. dana ilegal mengalir di bawah banyak rekening lepas pantai. kita harus melacak tujuan akhirnya.',
      ),
      createStage(
        'sandi-stage-5',
        "Stage 5 - Key 'I'",
        'I',
        'personnel movement outside authorized zones has been flagged. multiple subjects remain actIve in the restricted basement area. biometric sensors have been remotely compromised.',
        'pergerakan personel di luar zona resmi telah ditandai. beberapa subjek tetap aktif di area basement terbatas. sensor biometrik telah dikompromikan dari jarak jauh.',
      ),
    ],
  },
  {
    id: 'operation-virus',
    codename: 'VIRUS',
    alias: 'Sector: Core Server',
    title: 'Operation 2: VIRUS',
    theme: 'Serangan Siber & Ransomware',
    targetIp: '10.250.44.12',
    masterFile:
      '[ DECLASSIFIED: MASTER RECORD ] Analisis forensik mengonfirmasi bahwa infrastruktur utama kita telah disusupi oleh ransomware tingkat militer. Malware ini dijadwalkan untuk menghapus seluruh arsip intelijen dan menghancurkan pendingin perangkat keras dalam hitungan menit. Untuk menetralisir ancaman ini, kirimkan kill-switch code ke server komando musuh yang mengendalikan skrip tersebut melalui alamat IP 10.250.44.12 Segera eksekusi sebelum sistem kita hancur sepenuhnya',
    stages: [
      createStage(
        'virus-stage-1',
        "Stage 1 - Key 'V'",
        'V',
        'the main firewall has detected a critical vulnerability. an external probe is scanning the serVer ports. we must patch the exploit immediately before data leaks.',
        'firewall utama mendeteksi kerentanan kritis. probe eksternal sedang memindai port server. kita harus menambal celah ini segera sebelum data bocor.',
      ),
      createStage(
        'virus-stage-2',
        "Stage 2 - Key 'I'",
        'I',
        'unauthorized data extraction is happening in the core facIlity. massive amounts of encrypted files are being transferred out. halt the outbound traffic now.',
        'ekstraksi data tanpa izin terjadi di fasilitas inti. sejumlah besar file terenkripsi sedang dipindahkan keluar. hentikan trafik keluar sekarang.',
      ),
      createStage(
        'virus-stage-3',
        "Stage 3 - Key 'R'",
        'R',
        'a foreign script is attempting to hijack the main opeRation. the malware payload is currently dormant but highly unstable. isolate the affected subnet.',
        'skrip asing mencoba membajak operasi utama. payload malware saat ini dorman tetapi sangat tidak stabil. isolasi subnet yang terdampak.',
      ),
      createStage(
        'virus-stage-4',
        "Stage 4 - Key 'U'",
        'U',
        'security protocols have been bypassed using a secUre backdoor. the intruder has gained administrative privileges. revoke all access tokens instantly.',
        'protokol keamanan telah dilewati menggunakan backdoor tersembunyi. penyusup mendapatkan hak administratif. cabut semua token akses seketika.',
      ),
      createStage(
        'virus-stage-5',
        "Stage 5 - Key 'S'",
        'S',
        'the entire cooling syStem is being overridden remotely. hardware failure is imminent if we do not act fast. initiate the emergency manual lockdown.',
        'seluruh sistem pendingin sedang dioverride dari jarak jauh. kegagalan perangkat keras sudah dekat jika kita tidak bergerak cepat. mulai penguncian manual darurat.',
      ),
    ],
  },
  {
    id: 'operation-agent',
    codename: 'AGENT',
    alias: 'Sector: Border Route',
    title: 'Operation 3: AGENT',
    theme: 'Agen Ganda & Pencurian Cetak Biru',
    targetIp: '172.16.200.50',
    masterFile:
      '[ DECLASSIFIED: MASTER RECORD ] Operasi kontra-intelijen kami membuahkan hasil. Kami telah mengidentifikasi agen ganda di dalam jajaran eksekutif yang membocorkan cetak biru senjata rahasia dan mengorbankan personel penyamar kita. Data cetak biru tersebut saat ini sedang ditransmisikan secara langsung ke drop-server milik sindikat asing. Hentikan transmisi tersebut dan blokir akses jaringan eksternal dengan melumpuhkan titik routing utama mereka di IP 172.16.200.50 Lakukan sekarang sebelum rahasia negara jatuh ke tangan musuh',
    stages: [
      createStage(
        'agent-stage-1',
        "Stage 1 - Key 'A'",
        'A',
        'visual surveillance confirmed that the primary tArget left the safehouse. the individual was carrying a classified briefcase. follow the suspect discreetly.',
        'pengawasan visual mengonfirmasi target utama meninggalkan safehouse. individu itu membawa koper rahasia. ikuti tersangka secara diam-diam.',
      ),
      createStage(
        'agent-stage-2',
        "Stage 2 - Key 'G'",
        'G',
        'audio interception picked up a strange radio siGnal. the transmission contains coordinates for a covert rendezvous. decode the frequency quickly.',
        'penyadapan audio menangkap sinyal radio aneh. transmisi itu berisi koordinat untuk pertemuan rahasia. dekode frekuensinya dengan cepat.',
      ),
      createStage(
        'agent-stage-3',
        "Stage 3 - Key 'E'",
        'E',
        'restricted blueprints were accessed using a stolen viEw clearance. the mole has downloaded the stealth drone schematics. lock down the archive room.',
        'cetak biru terbatas diakses menggunakan clearance curian. mata-mata itu telah mengunduh skematik drone siluman. kunci ruang arsip sekarang.',
      ),
      createStage(
        'agent-stage-4',
        "Stage 4 - Key 'N'",
        'N',
        'our undercover operative has been compromised by a rogue ageNt. their true identity is no longer protected in the field. extract our personnel immediately.',
        'operatif penyamaran kami dikompromikan oleh agen nakal. identitas asli mereka tidak lagi terlindungi di lapangan. evakuasi personel kita segera.',
      ),
      createStage(
        'agent-stage-5',
        "Stage 5 - Key 'T'",
        'T',
        'the suspect is heading towards the extraction rouTe at the border. an unidentified helicopter is waiting for pickup. deploy the interception squad now.',
        'tersangka bergerak menuju rute ekstraksi di perbatasan. helikopter tak dikenal sedang menunggu penjemputan. kerahkan skuad intersepsi sekarang.',
      ),
    ],
  },
];
