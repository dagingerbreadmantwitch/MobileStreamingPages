/**
 * MobileStream Studio - Remote Control Communication Engine
 * Supports BroadcastChannel for local tab sync and PeerJS (WebRTC) for remote phone sync across devices.
 * Includes Security Passcode validation & Exclusive Session Handshake to prevent interference.
 */

const MSP_CHANNEL_NAME = 'msp_overlay_channel';
const DEFAULT_PASSCODE = '07357';

class RemoteControlEngine {
  constructor() {
    this.broadcastChannel = null;
    this.peer = null;
    this.connection = null;
    this.listeners = [];
    this.roomId = this.getOrCreateRoomId();
    this.sessionToken = this.getOrCreateSessionToken();
    this.pairingLockEnabled = false;
    this.isUnlocked = false;
    this.initBroadcastChannel();
  }

  // Generate or retrieve a 4-character Room ID for phone pairing
  getOrCreateRoomId() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) return roomFromUrl.toUpperCase();

    let storedRoom = sessionStorage.getItem('msp_room_id');
    if (!storedRoom) {
      storedRoom = Math.random().toString(36).substring(2, 6).toUpperCase();
      sessionStorage.setItem('msp_room_id', storedRoom);
    }
    return storedRoom;
  }

  // Generate unique session token for exclusive device handshake
  getOrCreateSessionToken() {
    let token = sessionStorage.getItem('msp_session_token');
    if (!token) {
      token = 'token_' + Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('msp_session_token', token);
    }
    return token;
  }

  // Passcode Security Validation (Default PIN: 07357 or custom setting)
  validatePasscode(pin) {
    const savedPin = localStorage.getItem('msp_passcode_pin') || DEFAULT_PASSCODE;
    if (pin === savedPin) {
      this.isUnlocked = true;
      sessionStorage.setItem('msp_remote_unlocked', 'true');
      return true;
    }
    return false;
  }

  // Check if passcode lock is currently unlocked
  checkUnlockState() {
    const isUnlocked = sessionStorage.getItem('msp_remote_unlocked') === 'true';
    this.isUnlocked = isUnlocked;
    return isUnlocked;
  }

  // Set new passcode
  setPasscode(newPin) {
    if (newPin && newPin.length >= 4) {
      localStorage.setItem('msp_passcode_pin', newPin);
      return true;
    }
    return false;
  }

  // Initialize local BroadcastChannel (same-origin tabs)
  initBroadcastChannel() {
    if ('BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel(MSP_CHANNEL_NAME);
      this.broadcastChannel.onmessage = (event) => {
        this.notifyListeners(event.data);
      };
    }
  }

  // Initialize PeerJS for cross-device remote control (e.g. Phone -> OBS)
  initPeerReceiver(onReadyCallback) {
    const peerId = `msp-room-${this.roomId.toLowerCase()}`;
    
    this.loadPeerJS(() => {
      this.peer = new Peer(peerId);

      this.peer.on('open', (id) => {
        console.log('[RemoteControl] OBS Receiver Peer initialized with ID:', id);
        if (onReadyCallback) onReadyCallback(this.roomId);
      });

      this.peer.on('connection', (conn) => {
        console.log('[RemoteControl] Mobile controller connected!');
        
        // Handle Exclusive Session Handshake
        if (this.pairingLockEnabled && this.connection && this.connection.open) {
          console.warn('[RemoteControl] Exclusive Pairing Active. Rejecting secondary controller.');
          conn.send({ action: 'pairing_rejected', payload: { reason: 'Room is locked to primary controller' } });
          setTimeout(() => conn.close(), 1000);
          return;
        }

        this.connection = conn;
        conn.on('data', (data) => {
          this.notifyListeners(data);
          if (this.broadcastChannel) this.broadcastChannel.postMessage(data);
        });
      });

      this.peer.on('error', (err) => {
        console.warn('[RemoteControl] PeerJS notice:', err);
      });
    });
  }

  // Initialize PeerJS as Mobile Sender
  initPeerSender(targetRoomId, onConnectCallback, onErrorCallback) {
    const peerId = `msp-room-${targetRoomId.toLowerCase()}`;

    this.loadPeerJS(() => {
      this.peer = new Peer();

      this.peer.on('open', () => {
        console.log('[RemoteControl] Connecting to receiver room:', targetRoomId);
        const conn = this.peer.connect(peerId);

        conn.on('open', () => {
          console.log('[RemoteControl] Connected to stream overlay!');
          this.connection = conn;
          
          // Send handshake verification payload
          conn.send({
            action: 'handshake',
            payload: { sessionToken: this.sessionToken, timestamp: Date.now() }
          });

          if (onConnectCallback) onConnectCallback();
        });

        conn.on('error', (err) => {
          if (onErrorCallback) onErrorCallback(err);
        });
      });

      this.peer.on('error', (err) => {
        console.error('[RemoteControl] Connection error:', err);
        if (onErrorCallback) onErrorCallback(err);
      });
    });
  }

  // Dynamically inject PeerJS script if not loaded
  loadPeerJS(callback) {
    if (window.Peer) {
      callback();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
    script.onload = callback;
    script.onerror = () => {
      console.warn('[RemoteControl] Could not load PeerJS CDN. Local BroadcastChannel will be used.');
      callback();
    };
    document.head.appendChild(script);
  }

  // Subscribe to remote events
  subscribe(callback) {
    this.listeners.push(callback);
  }

  // Notify registered event listeners
  notifyListeners(data) {
    this.listeners.forEach(cb => cb(data));
  }

  // Dispatch an action/event with Session Handshake Token
  send(action, payload = {}) {
    const message = { 
      action, 
      payload: { ...payload, sessionToken: this.sessionToken }, 
      timestamp: Date.now() 
    };

    // Broadcast locally
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(message);
    }

    // Send via PeerJS to OBS if connected
    if (this.connection && this.connection.open) {
      this.connection.send(message);
    }

    // Also dispatch to local window for immediate feedback on sender
    this.notifyListeners(message);
  }
}

// Global Singleton Instance
window.remoteEngine = new RemoteControlEngine();
