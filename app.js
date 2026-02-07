/* =============================================
   ECHO_OFF PWA - P2P COMMUNICATION LOGIC
   Version: 2.9.0 - Security & Simplicity

   (PATCH SAFE 2026-02-07)
   - FIX: Panic button variables (Escape x3) now consistent
   - FIX: SW registration points to sw.js (not old filename)
   - FIX: VPN animation countdown interval cleanup (no leaks)
   - FIX: Anti-copy rules allow normal typing/paste inside inputs/textarea
   - HARDEN: escapeHtml() for filenames and injected strings in innerHTML blocks
   ============================================= */

// Global Variables
let peer = null;
let currentConnection = null;
let myPeerId = null;
let targetPeerId = null; // Store target ID for display
let isHost = false;
let deferredPrompt = null;
let wakeLock = null; // Keep screen awake on mobile

// Advanced Features State
let messageHistory = []; // For panic button garbage overwrite (kept)
let activeMessages = []; // Track active message elements for instant destroy on reply

// ✅ Panic Button (FIXED)
let escapeKeyCount = 0;
let escapeKeyTimer = null;

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let fileTransferProgress = {};
let sasCode = null; // Short Authentication String
const CHUNK_SIZE = 16384; // 16KB chunks for file transfer
let currentFileTransfer = null;

// Audio Context for 8-bit sounds
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioContext = null;

// DOM Elements
const splashScreen = document.getElementById('splash-screen');
const terminal = document.getElementById('terminal');
const welcomeScreen = document.getElementById('welcome-screen');
const createRoomScreen = document.getElementById('create-room-screen');
const joinRoomScreen = document.getElementById('join-room-screen');
const chatScreen = document.getElementById('chat-screen');
const installPrompt = document.getElementById('install-prompt');

const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const btnBackFromCreate = document.getElementById('btn-back-from-create');
const btnBackFromJoin = document.getElementById('btn-back-from-join');
const btnConnect = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const btnSend = document.getElementById('btn-send');
const btnCopyId = document.getElementById('btn-copy-id');
const btnRegenerateId = document.getElementById('btn-regenerate-id');
const btnInstall = document.getElementById('btn-install');
const btnCancelInstall = document.getElementById('btn-cancel-install');

const roomIdDisplay = document.getElementById('room-id');
const peerIdInput = document.getElementById('peer-id-input');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const statusIndicator = document.getElementById('status');
const chatPeerId = document.getElementById('chat-peer-id');

/* =============================================
   SAFE HELPERS
   ============================================= */
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* =============================================
   SECURITY SIMULATION SYSTEM
   ============================================= */

// Security Animation State
let securityInterval = null;

// VPN Servers Pool (fictional)
const VPN_SERVERS = [
  { location: 'Zurich, Switzerland', protocol: 'WireGuard' },
  { location: 'Reykjavik, Iceland', protocol: 'OpenVPN' },
  { location: 'Singapore', protocol: 'IKEv2' },
  { location: 'Tokyo, Japan', protocol: 'WireGuard' },
  { location: 'Stockholm, Sweden', protocol: 'Shadowsocks' },
  { location: 'Amsterdam, Netherlands', protocol: 'OpenVPN' },
  { location: 'Tallinn, Estonia', protocol: 'IKEv2' }
];

// IP Pool (fictional)
const IP_POOL = [
  '185.220.101.', '94.142.241.', '199.249.230.',
  '45.141.215.', '163.172.67.', '176.126.252.',
  '198.98.51.', '185.100.87.', '46.232.251.'
];

// Encryption algorithms rotation
const ENCRYPTION_ALGOS = [
  'AES-256-GCM', 'ChaCha20-Poly1305', 'XChaCha20',
  'AES-256-CBC', 'Salsa20', 'Twofish-256'
];

// Generate random IP
function generateRandomIP(prefix) {
  const suffix = Math.floor(Math.random() * 255);
  return prefix + suffix;
}

// Generate random port
function generateRandomPort() {
  return Math.floor(10000 + Math.random() * 50000);
}

// Start security animation layer
function startSecurityAnimation() {
  const securityLayer = document.getElementById('security-layer');
  if (!securityLayer) return;

  securityLayer.style.display = 'block';

  let currentVPN = 0;
  let currentEncryption = 0;

  securityInterval = setInterval(() => {
    const vpnInfo = VPN_SERVERS[currentVPN];
    const encryption = ENCRYPTION_ALGOS[currentEncryption];
    const currentIP = generateRandomIP(IP_POOL[Math.floor(Math.random() * IP_POOL.length)]);
    const tunnelPort = generateRandomPort();

    updateSecurityDisplay({
      vpn: `${vpnInfo.location} [${vpnInfo.protocol}]`,
      ip: currentIP,
      port: tunnelPort,
      encryption: encryption,
      latency: Math.floor(8 + Math.random() * 15) + 'ms'
    });

    currentVPN = (currentVPN + 1) % VPN_SERVERS.length;
    currentEncryption = (currentEncryption + 1) % ENCRYPTION_ALGOS.length;
  }, 10000);

  const initialVPN = VPN_SERVERS[0];
  updateSecurityDisplay({
    vpn: `${initialVPN.location} [${initialVPN.protocol}]`,
    ip: generateRandomIP(IP_POOL[0]),
    port: generateRandomPort(),
    encryption: ENCRYPTION_ALGOS[0],
    latency: '12ms'
  });
}

// Stop security animation
function stopSecurityAnimation() {
  if (securityInterval) {
    clearInterval(securityInterval);
    securityInterval = null;
  }

  const securityLayer = document.getElementById('security-layer');
  if (securityLayer) {
    securityLayer.style.display = 'none';
  }
}

// Update security display
function updateSecurityDisplay(info) {
  const securityLayer = document.getElementById('security-layer');
  if (!securityLayer) return;

  securityLayer.innerHTML = `
    <div class="security-line">
      <span class="security-label">VPN Tunnel:</span>
      <span class="security-value typing">${escapeHtml(info.vpn)}</span>
    </div>
    <div class="security-line">
      <span class="security-label">Exit IP:</span>
      <span class="security-value">${escapeHtml(info.ip)}:${escapeHtml(info.port)}</span>
    </div>
    <div class="security-line">
      <span class="security-label">Encryption:</span>
      <span class="security-value">${escapeHtml(info.encryption)}</span>
    </div>
    <div class="security-line">
      <span class="security-label">Latency:</span>
      <span class="security-value">${escapeHtml(info.latency)}</span>
    </div>
  `;
}

/* =============================================
   REMOTE ENCRYPTION INDICATOR
   ============================================= */

let encryptionInterval = null;

function startEncryptionIndicator() {
  const indicator = document.getElementById('encryption-indicator');
  const matrix1 = document.getElementById('encryption-matrix-1');

  if (!indicator || !matrix1) return;

  indicator.classList.remove('hidden');

  const hexChars = '0123456789ABCDEF';

  function generateMatrixLine(length = 30) {
    let line = '';
    for (let i = 0; i < length; i++) {
      line += hexChars[Math.floor(Math.random() * hexChars.length)];
      if (i % 4 === 3) line += ' ';
    }
    return line;
  }

  encryptionInterval = setInterval(() => {
    matrix1.textContent = generateMatrixLine(30);
  }, 500);
}

function stopEncryptionIndicator() {
  const indicator = document.getElementById('encryption-indicator');
  if (indicator) indicator.classList.add('hidden');

  if (encryptionInterval) {
    clearInterval(encryptionInterval);
    encryptionInterval = null;
  }
}

/* =============================================
   CANAL SEGURO MATRIX ANIMATION
   ============================================= */
let canalSeguroInterval = null;

function startCanalSeguroAnimation() {
  const canalText = document.getElementById('canal-seguro-text');
  if (!canalText) return;

  const originalText = 'CANAL SEGURO';
  const matrixChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';

  canalSeguroInterval = setInterval(() => {
    let newText = '';
    for (let i = 0; i < originalText.length; i++) {
      if (originalText[i] === ' ') {
        newText += ' ';
      } else {
        if (Math.random() > 0.3) newText += originalText[i];
        else newText += matrixChars[Math.floor(Math.random() * matrixChars.length)];
      }
    }
    canalText.textContent = newText;
  }, 1000);
}

function stopCanalSeguroAnimation() {
  if (canalSeguroInterval) {
    clearInterval(canalSeguroInterval);
    canalSeguroInterval = null;
  }
  const canalText = document.getElementById('canal-seguro-text');
  if (canalText) canalText.textContent = 'CANAL SEGURO';
}

/* =============================================
   VPN ANIMATION (Countries + Hash + Countdown)
   ============================================= */
let vpnInterval = null;
// ✅ FIX: track countdown interval to avoid leak
let vpnCountdownInterval = null;

function startVPNAnimation() {
  const vpnLocation = document.getElementById('vpn-location');
  const vpnHash = document.getElementById('vpn-hash');
  const vpnCountdown = document.getElementById('vpn-countdown');

  if (!vpnLocation || !vpnHash || !vpnCountdown) return;

  const locations = [
    'VPN: Tokyo, JP | 103.5.140.142',
    'VPN: London, UK | 185.93.3.123',
    'VPN: New York, US | 192.241.135.67',
    'VPN: Berlin, DE | 46.4.119.88',
    'VPN: Singapore, SG | 139.180.141.205',
    'VPN: Sydney, AU | 45.248.77.142',
    'VPN: Paris, FR | 51.159.23.45',
    'VPN: Toronto, CA | 192.99.45.78',
    'VPN: Mumbai, IN | 103.253.145.29',
    'VPN: Seoul, KR | 211.249.45.123'
  ];

  const hexChars = '0123456789ABCDEF';
  let countdown = 2;

  function generateHash(length = 16) {
    let hash = '';
    for (let i = 0; i < length; i++) {
      hash += hexChars[Math.floor(Math.random() * hexChars.length)];
    }
    return hash;
  }

  function updateVPN() {
    const location = locations[Math.floor(Math.random() * locations.length)];
    vpnLocation.textContent = location;

    const hash = generateHash(16);
    vpnHash.textContent = `[${hash}]`;

    countdown = 2;
  }

  updateVPN();

  vpnInterval = setInterval(() => {
    updateVPN();
  }, 2000);

  // ✅ FIX: store interval so we can stop it
  if (vpnCountdownInterval) clearInterval(vpnCountdownInterval);
  vpnCountdownInterval = setInterval(() => {
    if (countdown > 0) {
      vpnCountdown.textContent = `[${countdown.toFixed(1)}s]`;
      countdown -= 0.1;
    }
  }, 100);
}

function stopVPNAnimation() {
  if (vpnInterval) {
    clearInterval(vpnInterval);
    vpnInterval = null;
  }
  if (vpnCountdownInterval) {
    clearInterval(vpnCountdownInterval);
    vpnCountdownInterval = null;
  }
}

/* =============================================
   ADVANCED FEATURES MODULE
   ============================================= */

// File transfer handler
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!currentConnection || !currentConnection.open) {
    addSystemMessage('/// ERROR: No hay conexion activa');
    return;
  }

  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    addSystemMessage('/// ERROR: Archivo muy grande (max 50MB)');
    return;
  }

  if (file.type.startsWith('image/')) {
    showImageSendOptions(file);
  } else {
    sendFile(file);
  }
}

// Show options for sending image
function showImageSendOptions(file) {
  const modal = document.createElement('div');
  modal.className = 'image-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <p class="modal-title">ENVIAR IMAGEN</p>
      <p class="modal-text">¿Cómo desea enviar esta imagen?</p>
      <div class="modal-buttons">
        <button id="btn-send-view-once" class="dos-button primary">Ver Una Vez</button>
        <button id="btn-send-saveable" class="dos-button">Permitir Guardar</button>
        <button id="btn-cancel-send" class="dos-button">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btn-send-view-once').onclick = () => {
    modal.remove();
    sendImageWithMode(file, 'view_once');
  };

  document.getElementById('btn-send-saveable').onclick = () => {
    modal.remove();
    sendImageWithMode(file, 'saveable');
  };

  document.getElementById('btn-cancel-send').onclick = () => {
    modal.remove();
  };
}

function sendImageWithMode(file, mode) {
  const reader = new FileReader();

  reader.onload = (e) => {
    const base64Data = e.target.result;

    const imageOffer = {
      type: 'IMAGE_OFFER',
      name: file.name,
      data: base64Data,
      mode: mode,
      timestamp: Date.now()
    };

    currentConnection.send(JSON.stringify(imageOffer));
    addSystemMessage(`/// Imagen enviada (${mode === 'view_once' ? 'Ver una vez' : 'Guardar permitido'})`);
  };

  reader.readAsDataURL(file);
}

function sendFile(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    const arrayBuffer = e.target.result;
    const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);

    const metadata = {
      type: 'FILE_META',
      name: file.name,
      size: file.size,
      mimeType: file.type,
      totalChunks: totalChunks
    };

    currentConnection.send(JSON.stringify(metadata));

    const progressDiv = document.createElement('div');
    progressDiv.className = 'file-progress';
    progressDiv.innerHTML = `
      <div class="progress-label">ENVIANDO: ${escapeHtml(file.name)}</div>
      <div class="progress-bar-container">
        <div id="upload-progress-bar" class="progress-bar-fill"></div>
      </div>
      <div class="progress-text" id="upload-progress-text">[░░░░░░░░░░] 0%</div>
    `;
    messagesContainer.appendChild(progressDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    let chunkIndex = 0;
    const sendNextChunk = () => {
      if (chunkIndex < totalChunks) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
        const chunk = arrayBuffer.slice(start, end);

        const chunkData = {
          type: 'FILE_CHUNK',
          index: chunkIndex,
          data: Array.from(new Uint8Array(chunk))
        };

        currentConnection.send(JSON.stringify(chunkData));

        chunkIndex++;
        const progress = Math.floor((chunkIndex / totalChunks) * 100);
        updateProgressBar('upload', progress);

        setTimeout(sendNextChunk, 10);
      } else {
        const endSignal = { type: 'FILE_END' };
        currentConnection.send(JSON.stringify(endSignal));

        setTimeout(() => {
          progressDiv.remove();
          addSystemMessage(`/// Archivo enviado: ${file.name}`);
        }, 1000);
      }
    };

    sendNextChunk();
  };

  reader.readAsArrayBuffer(file);
}

// Handle incoming image offer
function handleIncomingImageOffer(data) {
  const modal = document.createElement('div');
  modal.className = 'image-modal';

  const modeText = data.mode === 'view_once' ? 'VER UNA VEZ' : 'GUARDAR PERMITIDO';

  modal.innerHTML = `
    <div class="modal-content">
      <p class="modal-title">IMAGEN RECIBIDA</p>
      <p class="modal-text">Modo: ${escapeHtml(modeText)}</p>
      <img src="${data.data}" class="modal-image" />
      <div class="modal-buttons">
        ${data.mode === 'saveable' ? '<button id="btn-save-image" class="dos-button primary">Guardar</button>' : ''}
        <button id="btn-view-image" class="dos-button">Ver${data.mode === 'view_once' ? ' (Se destruirá)' : ''}</button>
        <button id="btn-close-image" class="dos-button">Cerrar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  if (data.mode === 'saveable') {
    document.getElementById('btn-save-image').onclick = () => {
      const link = document.createElement('a');
      link.href = data.data;
      link.download = (data.name ? String(data.name) : 'image.png');
      link.click();
      addSystemMessage('/// Imagen guardada');
      modal.remove();
    };
  }

  document.getElementById('btn-view-image').onclick = () => {
    const viewer = document.createElement('div');
    viewer.className = 'image-viewer';
    viewer.innerHTML = `
      <img src="${data.data}" class="viewer-image" />
      <button class="viewer-close">X</button>
    `;
    document.body.appendChild(viewer);

    viewer.querySelector('.viewer-close').onclick = () => {
      viewer.remove();
      modal.remove();
      if (data.mode === 'view_once') {
        addSystemMessage('/// Imagen destruida (vista una vez)');
      }
    };
  };

  document.getElementById('btn-close-image').onclick = () => {
    modal.remove();
    if (data.mode === 'view_once') {
      addSystemMessage('/// Imagen rechazada (no vista)');
    }
  };
}

// Receive file handler
let incomingFile = {
  metadata: null,
  chunks: [],
  receivedChunks: 0
};

function handleIncomingFileData(data) {
  if (data.type === 'FILE_META') {
    incomingFile = {
      metadata: data,
      chunks: new Array(data.totalChunks),
      receivedChunks: 0
    };

    const progressDiv = document.createElement('div');
    progressDiv.className = 'file-progress';
    progressDiv.id = 'download-progress';
    progressDiv.innerHTML = `
      <div class="progress-label">RECIBIENDO: ${escapeHtml(data.name)}</div>
      <div class="progress-bar-container">
        <div id="download-progress-bar" class="progress-bar-fill"></div>
      </div>
      <div class="progress-text" id="download-progress-text">[░░░░░░░░░░] 0%</div>
    `;
    messagesContainer.appendChild(progressDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

  } else if (data.type === 'FILE_CHUNK') {
    incomingFile.chunks[data.index] = new Uint8Array(data.data);
    incomingFile.receivedChunks++;

    const progress = Math.floor((incomingFile.receivedChunks / incomingFile.metadata.totalChunks) * 100);
    updateProgressBar('download', progress);

  } else if (data.type === 'FILE_END') {
    const blob = new Blob(incomingFile.chunks, { type: incomingFile.metadata.mimeType });
    const url = URL.createObjectURL(blob);

    const progressDiv = document.getElementById('download-progress');
    if (progressDiv) progressDiv.remove();

    addFileDownloadMessage(incomingFile.metadata.name, url);

    incomingFile = { metadata: null, chunks: [], receivedChunks: 0 };
  }
}

// Update progress bar (ASCII style)
function updateProgressBar(type, percentage) {
  const barId = type === 'upload' ? 'upload-progress-bar' : 'download-progress-bar';
  const textId = type === 'upload' ? 'upload-progress-text' : 'download-progress-text';

  const barElement = document.getElementById(barId);
  const textElement = document.getElementById(textId);

  if (barElement) barElement.style.width = percentage + '%';

  if (textElement) {
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    textElement.textContent = `[${bar}] ${percentage}%`;
  }
}

// Add file download message
function addFileDownloadMessage(filename, url) {
  const safeName = escapeHtml(filename);

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message file-message';

  const timestamp = new Date().toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const downloadId = `download-${Date.now()}`;

  messageDiv.innerHTML = `
    <div class="message-header">[${timestamp}] FILE RECEIVED <span class="countdown-timer">[⏳ PENDIENTE]</span></div>
    <div class="message-body">
      <div class="file-download">
        <span class="file-icon">📎</span>
        <span class="file-name">${safeName}</span>
        <a href="${url}" download="${safeName}" class="file-download-btn" id="${downloadId}">[ DOWNLOAD ]</a>
      </div>
    </div>
  `;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  const downloadBtn = messageDiv.querySelector('.file-download-btn');
  const timerSpan = messageDiv.querySelector('.countdown-timer');

  downloadBtn.addEventListener('click', () => {
    timerSpan.textContent = '[✓ DESCARGANDO...]';
    timerSpan.style.color = '#00CC00';

    setTimeout(() => {
      timerSpan.textContent = '[💾 DISPONIBLE]';

      setTimeout(() => {
        startCountdownTimer(messageDiv, 20, () => {
          URL.revokeObjectURL(url);
        });
      }, 1000);
    }, 3000);

    // prevent multiple countdowns
    downloadBtn.replaceWith(downloadBtn.cloneNode(true));
  });
}

async function startVoiceRecording() {
  if (isRecording) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      sendVoiceNote(audioBlob);
      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();
    isRecording = true;

    const recBtn = document.getElementById('btn-record');
    if (recBtn) {
      recBtn.classList.add('recording');
      recBtn.textContent = '● REC';
    }

  } catch (err) {
    console.error('[VOICE] Error:', err);
    addSystemMessage('/// ERROR: No se pudo acceder al microfono');
  }
}

function stopVoiceRecording() {
  if (!isRecording || !mediaRecorder) return;

  mediaRecorder.stop();
  isRecording = false;

  const recBtn = document.getElementById('btn-record');
  if (recBtn) {
    recBtn.classList.remove('recording');
    recBtn.textContent = '[ REC ]';
  }
}

function sendVoiceNote(audioBlob) {
  if (!currentConnection || !currentConnection.open) {
    addSystemMessage('/// ERROR: No hay conexion activa');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const base64Audio = reader.result.split(',')[1];
    const voiceData = {
      type: 'VOICE_NOTE',
      audio: base64Audio,
      timestamp: Date.now()
    };

    currentConnection.send(JSON.stringify(voiceData));
    addVoiceNoteMessage('sent', base64Audio);
  };

  reader.readAsDataURL(audioBlob);
}

function handleIncomingVoiceNote(data) {
  addVoiceNoteMessage('received', data.audio);
}

function addVoiceNoteMessage(type, base64Audio) {
  const audioUrl = `data:audio/webm;base64,${base64Audio}`;
  const label = type === 'sent' ? 'TU' : 'PEER';

  const timestamp = new Date().toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const messageDiv = document.createElement('div');
  messageDiv.className = `message voice-message ${type}`;
  messageDiv.innerHTML = `
    <div class="message-header">[${timestamp}] ${label} VOICE NOTE <span class="countdown-timer">[▶ REPRODUCIR]</span></div>
    <div class="message-body">
      <audio controls class="voice-player">
        <source src="${audioUrl}" type="audio/webm">
      </audio>
    </div>
  `;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  const audioElement = messageDiv.querySelector('.voice-player');
  const timerSpan = messageDiv.querySelector('.countdown-timer');

  audioElement.addEventListener('ended', () => {
    timerSpan.textContent = '[✓ REPRODUCIDO]';
    timerSpan.style.color = '#00CC00';

    setTimeout(() => {
      timerSpan.textContent = '[🔊 DISPONIBLE]';

      setTimeout(() => {
        startCountdownTimer(messageDiv, 20);
      }, 1000);
    }, 2000);
  });

  audioElement.addEventListener('play', () => {
    timerSpan.textContent = '[▶ REPRODUCIENDO]';
    timerSpan.style.color = '#00CC00';
  });

  audioElement.addEventListener('pause', () => {
    if (!audioElement.ended) {
      timerSpan.textContent = '[⏸ PAUSADO]';
      timerSpan.style.color = '#808080';
    }
  });
}

function startCountdownTimer(messageElement, seconds, beforeDestroy = null) {
  const timerSpan = messageElement.querySelector('.countdown-timer');
  if (!timerSpan) return;

  let remaining = seconds;

  const countdownInterval = setInterval(() => {
    remaining--;

    if (remaining > 0) {
      timerSpan.textContent = `[🕒 ${remaining}s]`;
      timerSpan.style.color = remaining <= 3 ? '#CC0000' : '#808080';
    } else {
      clearInterval(countdownInterval);

      if (beforeDestroy) beforeDestroy();

      destroyMessage(messageElement);
    }
  }, 1000);

  timerSpan.textContent = `[🕒 ${remaining}s]`;
  timerSpan.style.color = '#808080';
}

function destroyMessage(messageElement) {
  messageElement.style.transition = 'opacity 0.5s';
  messageElement.style.opacity = '0';

  setTimeout(() => {
    if (messageElement.parentNode) messageElement.remove();
    addSystemMessage('/// Mensaje autodestruido');
  }, 500);
}

// Generate SAS from connection fingerprint
async function generateSAS() {
  try {
    const fingerprint = myPeerId + (isHost ? currentConnection.peer : targetPeerId);

    const hash = await hashString(fingerprint);
    const shortHash = hash.substring(0, 8);

    const emojis = ['🥑', '🍕', '🎯', '🔑', '🌟', '🎨', '🔥', '💎', '🎭', '🚀'];
    const emojiIndex = parseInt(shortHash.substring(0, 2), 16) % emojis.length;
    const numericCode = parseInt(shortHash.substring(2, 6), 16) % 10000;

    const sas = `${emojis[emojiIndex]} ${numericCode.toString().padStart(4, '0')}`;
    displaySAS(sas);
  } catch (err) {
    console.error('[SAS] Error:', err);
    displaySAS('🔐 E2E');
  }
}

async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function displaySAS(sas) {
  const sasDisplay = document.getElementById('sas-display');
  if (sasDisplay) {
    sasDisplay.textContent = `[${sas}]`;
    sasDisplay.classList.add('active');
    sasDisplay.style.display = 'inline-block';
  } else {
    console.error('[SAS] Element not found');
  }
}

/* =============================================
   PANIC BUTTON (ESC x3) — FIXED
   ============================================= */
function initPanicButton() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      escapeKeyCount++;

      if (escapeKeyCount === 1) {
        if (escapeKeyTimer) clearTimeout(escapeKeyTimer);
        escapeKeyTimer = setTimeout(() => {
          escapeKeyCount = 0;
        }, 2000);
      }

      if (escapeKeyCount === 3) {
        triggerPanicMode();
      }
    }
  });
}

/* =============================================
   SECURITY PROTECTION - ANTI COPY (SAFE FOR INPUTS)
   ============================================= */
function initSecurityProtection() {
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
  document.body.style.msUserSelect = 'none';

  let focusLostCount = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && currentConnection) {
      focusLostCount++;
      if (focusLostCount >= 3) {
        addSystemMessage('⚠ ADVERTENCIA: Actividad sospechosa detectada');
        addSystemMessage('⚠ Posible intento de captura de pantalla');
        focusLostCount = 0;
      }
    }
  });

  addWatermarkToMessages();

  // Block copy/cut generally, but allow in inputs/textarea
  function isEditableTarget(t) {
    if (!t) return false;
    const tag = (t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return true;
    if (t.isContentEditable) return true;
    return false;
  }

  document.addEventListener('copy', (e) => {
    if (isEditableTarget(e.target)) return; // allow copy in inputs if you want
    e.preventDefault();
    return false;
  });

  document.addEventListener('cut', (e) => {
    if (isEditableTarget(e.target)) return;
    e.preventDefault();
    return false;
  });

  document.addEventListener('contextmenu', (e) => {
    if (isEditableTarget(e.target)) return; // allow context menu in inputs
    e.preventDefault();
    return false;
  });

  document.addEventListener('keydown', (e) => {
    // Allow normal operations inside editable elements
    if (isEditableTarget(e.target)) return;

    if ((e.ctrlKey || e.metaKey) &&
      (e.key === 'c' || e.key === 'C' ||
       e.key === 'x' || e.key === 'X' ||
       e.key === 'a' || e.key === 'A' ||
       e.key === 'p' || e.key === 'P' ||
       e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      return false;
    }
  });
}

function addWatermarkToMessages() {
  const watermark = document.createElement('div');
  watermark.className = 'security-watermark';
  watermark.textContent = `ECHO_OFF | ${Date.now()} | CONFIDENCIAL`;
  watermark.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 48px;
    color: rgba(0, 255, 0, 0.05);
    pointer-events: none;
    user-select: none;
    z-index: 1;
  `;

  const chatScreenEl = document.getElementById('chat-screen');
  if (chatScreenEl) {
    chatScreenEl.style.position = 'relative';
    chatScreenEl.appendChild(watermark);
  }
}

function triggerPanicMode() {
  if (currentConnection) {
    currentConnection.close();
    currentConnection = null;
  }

  if (peer) {
    peer.destroy();
    peer = null;
  }

  document.body.innerHTML = '';

  const garbage = Array(1000).fill(0).map(() => Math.random().toString(36));
  myPeerId = garbage[0];
  targetPeerId = garbage[1];

  if (messagesContainer) {
    try { messagesContainer.innerHTML = garbage.join(''); } catch (_) {}
  }

  setTimeout(() => {
    window.location.href = 'https://www.google.com';
  }, 100);
}

/* =============================================
   8-BIT SOUND GENERATOR
   ============================================= */
function initAudio() {
  if (!audioContext) audioContext = new AudioContext();
}

function play8BitSound(frequency, duration, type = 'square') {
  initAudio();

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = type;

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

function playStartupSound() { play8BitSound(440, 0.15); }
function playCreateRoomSound() { play8BitSound(440, 0.1); setTimeout(() => play8BitSound(554, 0.1), 100); }
function playJoinRoomSound() { play8BitSound(554, 0.1); setTimeout(() => play8BitSound(440, 0.1), 100); }
function playDisconnectSound() { play8BitSound(220, 0.2); }

/* =============================================
   INITIALIZATION
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  console.log('[ECHO_OFF v2.9.0] Security & Simplicity - Sistema inicializado');
  setupEventListeners();
  checkServiceWorkerSupport();
  initSplashScreen();
  setupPWAInstallPrompt();
  requestWakeLock();
  initPanicButton();
  initSecurityProtection();

  document.addEventListener('click', initAudio, { once: true });

  setTimeout(() => {
    playStartupSound();
  }, 500);
});

/* =============================================
   PWA INSTALL PROMPT
   ============================================= */
function setupPWAInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    setTimeout(() => {
      if (deferredPrompt && installPrompt) {
        installPrompt.classList.remove('hidden');
      }
    }, 3000);
  });

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  if (isIOS && !isStandalone) {
    setTimeout(() => {
      addSystemMessage('ℹ iOS: Toque el botón Compartir y luego "Añadir a pantalla de inicio"');
    }, 3000);
  }

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (installPrompt) installPrompt.classList.add('hidden');
  });
}

/* =============================================
   WAKE LOCK
   ============================================= */
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {});
    }
  } catch (err) {
    console.error('[WAKE LOCK] Error:', err);
  }
}

document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible') {
    await requestWakeLock();
  }
});

document.addEventListener('pagehide', () => {});

/* =============================================
   HEARTBEAT
   ============================================= */
let heartbeatInterval = null;

function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  heartbeatInterval = setInterval(() => {
    if (currentConnection && currentConnection.open) {
      try {
        currentConnection.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
      } catch (err) {
        console.error('[HEARTBEAT] Error:', err);
      }
    }
  }, 10000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/* =============================================
   SPLASH SCREEN
   ============================================= */
function initSplashScreen() {
  setTimeout(() => {
    if (splashScreen) splashScreen.classList.remove('active');
    if (terminal) terminal.classList.remove('hidden');
  }, 3000);
}

/* =============================================
   SERVICE WORKER FORCE UPDATE
   ============================================= */
function forceServiceWorkerUpdate() {
  console.log('[PWA] Forzando actualización del Service Worker...');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      Promise.all(registrations.map(reg => reg.unregister()))
        .then(() => caches.keys())
        .then(cacheNames => Promise.all(cacheNames.map(cacheName => caches.delete(cacheName))))
        .then(() => {
          alert('Actualización forzada completada. La página se recargará.');
          window.location.reload();
        })
        .catch(err => {
          console.error('[PWA] Error al forzar actualización:', err);
          alert('Error al actualizar. Intenta cerrar todas las pestañas y volver a abrir.');
        });
    });
  } else {
    alert('Service Workers no soportados en este navegador');
  }
}

/* =============================================
   SERVICE WORKER REGISTRATION (PWA)
   ✅ FIX: register sw.js (not old filename)
   ============================================= */
function checkServiceWorkerSupport() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js?v=20260207_02', { updateViaCache: 'none' })
      .then(reg => {
        console.log('[PWA] Service Worker registrado:', reg.scope);

        reg.update().catch(() => {});

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] Nueva versión lista. Recargando...');
              setTimeout(() => window.location.reload(), 1000);
            }
          });
        });
      })
      .catch(err => console.error('[PWA] Fallo al registrar Service Worker:', err));
  }
}

/* =============================================
   EVENT LISTENERS SETUP
   ============================================= */
function setupEventListeners() {
  btnCreateRoom && btnCreateRoom.addEventListener('click', createRoom);
  btnJoinRoom && btnJoinRoom.addEventListener('click', showJoinScreen);

  btnBackFromCreate && btnBackFromCreate.addEventListener('click', () => {
    destroyPeer();
    showScreen(welcomeScreen);
  });

  btnBackFromJoin && btnBackFromJoin.addEventListener('click', () => {
    if (peerIdInput) peerIdInput.value = '';
    showScreen(welcomeScreen);
  });

  btnConnect && btnConnect.addEventListener('click', connectToPeer);
  btnDisconnect && btnDisconnect.addEventListener('click', disconnect);
  btnCopyId && btnCopyId.addEventListener('click', copyRoomId);
  btnRegenerateId && btnRegenerateId.addEventListener('click', regenerateRoomId);

  btnSend && btnSend.addEventListener('click', sendMessage);

  messageInput && messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  peerIdInput && peerIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') connectToPeer();
  });

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] Elección de instalación: ${outcome}`);
      deferredPrompt = null;
      installPrompt && installPrompt.classList.add('hidden');
    });
  }

  if (btnCancelInstall) {
    btnCancelInstall.addEventListener('click', () => {
      installPrompt && installPrompt.classList.add('hidden');
    });
  }

  const btnForceUpdate = document.getElementById('btn-force-update');
  if (btnForceUpdate) btnForceUpdate.addEventListener('click', forceServiceWorkerUpdate);

  const btnUploadFile = document.getElementById('btn-upload-file');
  const fileInput = document.getElementById('file-input');
  if (btnUploadFile && fileInput) {
    btnUploadFile.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
  }

  const btnRecord = document.getElementById('btn-record');
  if (btnRecord) {
    btnRecord.addEventListener('mousedown', startVoiceRecording);
    btnRecord.addEventListener('mouseup', stopVoiceRecording);
    btnRecord.addEventListener('touchstart', (e) => { e.preventDefault(); startVoiceRecording(); });
    btnRecord.addEventListener('touchend', (e) => { e.preventDefault(); stopVoiceRecording(); });
  }
}

/* =============================================
   SCREEN NAVIGATION
   ============================================= */
function showScreen(screen) {
  [welcomeScreen, createRoomScreen, joinRoomScreen, chatScreen].forEach(s => {
    if (s) s.classList.remove('active');
  });
  if (screen) screen.classList.add('active');
}

/* =============================================
   GENERATE UNIQUE RANDOM ID
   ============================================= */
function generateUniqueId() {
  const timestamp = Date.now().toString(36).toUpperCase();

  const randomArray = new Uint32Array(2);
  crypto.getRandomValues(randomArray);
  const random1 = randomArray[0].toString(36).substring(0, 6).toUpperCase();
  const random2 = randomArray[1].toString(36).substring(0, 6).toUpperCase();

  const entropy = Math.floor(performance.now() * 1000).toString(36).substring(0, 4).toUpperCase();

  return `ECHO_${timestamp}${random1}${random2}${entropy}`;
}

/* =============================================
   PEERJS CONNECTION
   ============================================= */
function createRoom() {
  showScreen(createRoomScreen);
  playCreateRoomSound();

  myPeerId = generateUniqueId();

  peer = new Peer(myPeerId, {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  });

  peer.on('open', (id) => {
    console.log('[PEER] Sala creada:', id);

    typeTextIntoInput(roomIdDisplay, id, 30, () => {
      isHost = true;
      updateStatus('EN ESPERA', 'warning');
      addSystemMessage('/// Sala ECHO_OFF creada');
      addSystemMessage(`/// ID: ${id}`);
      addSystemMessage('/// Esperando conexion entrante...');
    });
  });

  peer.on('connection', (conn) => {
    if (currentConnection && currentConnection.open) {
      addSystemMessage('/// Ya existe una conexion activa');
      addSystemMessage('/// Esta sala solo admite 1 usuario simultaneo');
      conn.close();
      return;
    }

    targetPeerId = conn.peer;

    const approvalMessage = `═══════════════════════════════════════════════

NUEVA SOLICITUD DE CONEXION

Usuario desea unirse a tu sala
ID: ${conn.peer}

¿Permitir acceso a esta sala?

═══════════════════════════════════════════════`;

    const approve = confirm(approvalMessage);

    if (!approve) {
      conn.close();
      addSystemMessage('/// Conexion rechazada');
      addSystemMessage(`/// Usuario ${conn.peer} fue bloqueado`);
      return;
    }

    currentConnection = conn;
    setupConnectionHandlers(conn);
    addSystemMessage(`/// Peer conectado: ${conn.peer}`);
    showScreen(chatScreen);
    if (chatPeerId) chatPeerId.textContent = conn.peer;
    updateStatus('CONECTADO', 'success');
  });

  peer.on('error', (err) => {
    console.error('[PEER] Error:', err);
    addSystemMessage(`/// ERROR: ${err.type}`);
  });
}

function showJoinScreen() {
  showScreen(joinRoomScreen);
  if (peerIdInput) {
    peerIdInput.value = '';
    peerIdInput.focus();
  }
}

function connectToPeer() {
  const targetId = (peerIdInput ? peerIdInput.value.trim() : '');

  if (!targetId) {
    alert('Por favor ingrese el ID de la sala');
    return;
  }

  if (!targetId.startsWith('ECHO_')) {
    alert('ID invalido. Debe comenzar con ECHO_');
    return;
  }

  targetPeerId = targetId;

  playJoinRoomSound();

  myPeerId = generateUniqueId();

  peer = new Peer(myPeerId, {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  });

  peer.on('open', () => {
    console.log('[PEER] Conectando a:', targetId);

    showConnectionProgress(() => {
      currentConnection = peer.connect(targetId);
      setupConnectionHandlers(currentConnection);
    });
  });

  peer.on('error', (err) => {
    console.error('[PEER] Error:', err);
    let errorMsg = 'No se pudo conectar';

    if (err.type === 'peer-unavailable') errorMsg = 'Sala no encontrada o inactiva';
    else if (err.type === 'network') errorMsg = 'Error de red';
    else if (err.type === 'server-error') errorMsg = 'Error del servidor PeerJS';

    alert(`ERROR DE CONEXION\n\n${errorMsg}\n\nVerifique el ID e intente nuevamente`);
  });
}

function setupConnectionHandlers(conn) {
  conn.on('open', () => {
    showScreen(chatScreen);

    const displayId = isHost ? conn.peer : targetPeerId;
    if (chatPeerId) chatPeerId.textContent = displayId;

    updateStatus('CONECTADO', 'success');
    addSystemMessage('/// ===================================');
    addSystemMessage('/// CONEXION P2P 1:1 ESTABLECIDA');
    addSystemMessage('/// Canal cifrado E2E activo');
    addSystemMessage('/// Privacidad maxima garantizada');
    addSystemMessage('/// Arquitectura: Peer-to-Peer directo');
    addSystemMessage('/// ===================================');

    startSecurityAnimation();
    startEncryptionIndicator();
    startCanalSeguroAnimation();
    startVPNAnimation();
    startHeartbeat();

    setTimeout(() => {
      generateSAS();
    }, 500);
  });

  conn.on('data', (data) => {
    try {
      const parsed = JSON.parse(data);

      if (parsed.type === 'heartbeat') return;

      if (parsed.type === 'FILE_META' || parsed.type === 'FILE_CHUNK' || parsed.type === 'FILE_END') {
        handleIncomingFileData(parsed);
      } else if (parsed.type === 'VOICE_NOTE') {
        handleIncomingVoiceNote(parsed);
      } else if (parsed.type === 'IMAGE_OFFER') {
        handleIncomingImageOffer(parsed);
      } else {
        addMessage(data, 'received');
      }
    } catch (e) {
      addMessage(data, 'received');
    }
  });

  conn.on('close', () => {
    updateStatus('DESCONECTADO', 'error');
    addSystemMessage('/// Conexión terminada');
    stopSecurityAnimation();
    stopEncryptionIndicator();
    stopCanalSeguroAnimation();
    stopVPNAnimation();
    stopHeartbeat();
    currentConnection = null;
  });

  conn.on('error', (err) => {
    console.error('[CONNECTION] Error:', err);
    addSystemMessage(`/// ERROR: ${err}`);
  });
}

/* =============================================
   MESSAGING
   ============================================= */
function sendMessage() {
  const message = messageInput ? messageInput.value.trim() : '';
  if (!message) return;

  if (!currentConnection || !currentConnection.open) {
    alert('No hay conexion activa');
    return;
  }

  destroyAllActiveMessages();

  currentConnection.send(message);
  addMessage(message, 'sent');

  if (messageInput) messageInput.value = '';

  setTimeout(() => {
    messageInput && messageInput.focus();
  }, 100);
}

function addMessage(content, type) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', type);

  const timestamp = new Date().toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const header = document.createElement('div');
  header.classList.add('message-header');

  const timerSpan = document.createElement('span');
  timerSpan.className = 'message-countdown';
  timerSpan.style.marginLeft = '10px';
  timerSpan.style.color = '#808080';

  header.textContent = `[${timestamp}] ${type === 'sent' ? 'TU' : 'PEER'}`;
  header.appendChild(timerSpan);

  const body = document.createElement('div');
  body.classList.add('message-body');

  messageDiv.appendChild(header);
  messageDiv.appendChild(body);

  if (!messagesContainer) {
    console.error('[ERROR] Messages container not found');
    return;
  }

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  activeMessages.push({
    element: messageDiv,
    body: body,
    content: content,
    timestamp: Date.now()
  });

  if (type === 'received') {
    decryptMessage(body, content, () => {
      setTimeout(() => {
        messageDiv.style.transition = 'color 2s ease';
        messageDiv.style.color = '#606060';
        timerSpan.style.color = '#505050';
      }, 3000);
    });
  } else {
    body.textContent = `> ${content}`;
    setTimeout(() => {
      messageDiv.style.transition = 'color 2s ease';
      messageDiv.style.color = '#606060';
      timerSpan.style.color = '#505050';
    }, 3000);
  }

  timerSpan.textContent = '[Responde para destruir]';
  timerSpan.style.color = '#808080';
}

function decryptMessage(element, finalText, callback) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  const length = finalText.length;
  let iterations = 0;
  const maxIterations = 20;

  element.classList.add('message-encrypted');

  const interval = setInterval(() => {
    element.textContent = '> ' + finalText
      .split('')
      .map((char, index) => {
        if (index < iterations) return finalText[index];
        return chars[Math.floor(Math.random() * chars.length)];
      })
      .join('');

    iterations += length / maxIterations;

    if (iterations >= length) {
      clearInterval(interval);
      element.textContent = `> ${finalText}`;
      element.classList.remove('message-encrypted');
      element.classList.add('message-decrypted');
      if (callback) callback();
    }
  }, 50);
}

function destroyAllActiveMessages() {
  activeMessages.forEach(msg => {
    if (msg.element && msg.element.parentNode) {
      disappearMessage(msg.element, msg.body, msg.content);
    }
  });
  activeMessages = [];
}

function disappearMessage(messageDiv, bodyElement, originalText) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let text = originalText;

  bodyElement.classList.add('message-disappearing');

  const interval = setInterval(() => {
    if (text.length === 0) {
      clearInterval(interval);
      messageDiv.style.opacity = '0';
      setTimeout(() => {
        messageDiv.remove();
      }, 500);
      return;
    }

    text = text.split('').map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
    text = text.slice(0, -1);
    bodyElement.textContent = `> ${text}`;
  }, 100);
}

function addSystemMessage(content) {
  if (!messagesContainer) return;
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', 'system');
  messageDiv.textContent = content;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/* =============================================
   UTILITY FUNCTIONS
   ============================================= */
function copyRoomId() {
  const id = roomIdDisplay ? roomIdDisplay.value : '';
  if (!id) return;

  const tempTextArea = document.createElement('textarea');
  tempTextArea.value = id;
  tempTextArea.style.position = 'fixed';
  tempTextArea.style.left = '-9999px';
  tempTextArea.style.top = '0';
  tempTextArea.style.userSelect = 'text';
  tempTextArea.style.webkitUserSelect = 'text';
  document.body.appendChild(tempTextArea);

  try {
    tempTextArea.focus();
    tempTextArea.select();

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(id).then(() => {
        addSystemMessage('/// ID copiado al portapapeles');
        document.body.removeChild(tempTextArea);
      }).catch(() => {
        const successful = document.execCommand('copy');
        addSystemMessage(successful ? '/// ID copiado al portapapeles' : '/// ERROR: No se pudo copiar el ID');
        document.body.removeChild(tempTextArea);
      });
    } else {
      const successful = document.execCommand('copy');
      addSystemMessage(successful ? '/// ID copiado al portapapeles' : '/// ERROR: No se pudo copiar el ID');
      document.body.removeChild(tempTextArea);
    }
  } catch (err) {
    console.error('[CLIPBOARD] Error:', err);
    addSystemMessage('/// ERROR: No se pudo copiar el ID');
    document.body.removeChild(tempTextArea);
  }
}

function regenerateRoomId() {
  if (!peer || !isHost) return;

  addSystemMessage('/// Regenerando ID de sala...');
  destroyPeer();

  setTimeout(() => {
    createRoom();
  }, 500);
}

function updateStatus(text, type) {
  if (!statusIndicator) return;
  statusIndicator.textContent = `● ${text}`;
  statusIndicator.className = type;
}

function disconnect() {
  playDisconnectSound();
  stopSecurityAnimation();
  stopEncryptionIndicator();
  stopCanalSeguroAnimation();
  stopVPNAnimation();
  stopHeartbeat();

  if (currentConnection) {
    currentConnection.close();
    currentConnection = null;
  }
  destroyPeer();
  showScreen(welcomeScreen);
  updateStatus('OFFLINE', 'offline');
  if (messagesContainer) messagesContainer.innerHTML = '';
}

function destroyPeer() {
  if (peer) {
    peer.destroy();
    peer = null;
  }
  isHost = false;
  myPeerId = null;
}

/* =============================================
   ANIMATION UTILITIES
   ============================================= */
function typeTextIntoInput(inputElement, text, speed = 50, callback = null) {
  if (!inputElement) return;
  inputElement.value = '';
  let index = 0;

  const typingInterval = setInterval(() => {
    if (index < text.length) {
      inputElement.value += text[index];
      index++;
    } else {
      clearInterval(typingInterval);
      if (callback) callback();
    }
  }, speed);
}

function showConnectionProgress(callback) {
  const steps = [
    '/// Iniciando handshake P2P...',
    '/// Estableciendo tunel seguro...',
    '/// Verificando identidad del peer...',
    '/// Negociando protocolos de encriptacion...',
    '/// Conexion establecida'
  ];

  let currentStep = 0;

  const progressInterval = setInterval(() => {
    if (currentStep < steps.length) {
      addSystemMessage(steps[currentStep]);
      currentStep++;
    } else {
      clearInterval(progressInterval);
      if (callback) setTimeout(callback, 300);
    }
  }, 400);
}

function showProgressBar(container, duration = 2000, callback = null) {
  const progressDiv = document.createElement('div');
  progressDiv.className = 'progress-bar-container';
  progressDiv.innerHTML = `
    <div class="progress-bar">
      <div class="progress-bar-fill"></div>
    </div>
    <div class="progress-text">Procesando...</div>
  `;

  container.appendChild(progressDiv);

  const fillElement = progressDiv.querySelector('.progress-bar-fill');
  let progress = 0;
  const increment = 100 / (duration / 50);

  const progressInterval = setInterval(() => {
    progress += increment;
    if (progress >= 100) {
      progress = 100;
      clearInterval(progressInterval);
      setTimeout(() => {
        container.removeChild(progressDiv);
        if (callback) callback();
      }, 300);
    }
    fillElement.style.width = progress + '%';
  }, 50);
}

function glitchText(element, duration = 1000) {
  const originalText = element.textContent;
  const chars = '!<>-_\\/[]{}—=+*^?#________';
  let iterations = 0;

  const glitchInterval = setInterval(() => {
    element.textContent = originalText
      .split('')
      .map((char, index) => {
        if (index < iterations) return originalText[index];
        return chars[Math.floor(Math.random() * chars.length)];
      })
      .join('');

    iterations += 1 / 3;

    if (iterations >= originalText.length) {
      clearInterval(glitchInterval);
      element.textContent = originalText;
    }
  }, 30);
}

/* =============================================
   AUTO-CLEANUP ON PAGE UNLOAD
   ============================================= */
window.addEventListener('beforeunload', () => {
  disconnect();
});
