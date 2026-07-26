/**
 * MobileStream Studio - Remote Control Communication Engine
 * Supports BroadcastChannel for local tab sync and PeerJS (WebRTC) for remote phone sync across devices.
 */

const MSP_CHANNEL_NAME = 'msp_overlay_channel';

class RemoteControlEngine {
  constructor() {
    this.broadcastChannel = null;
    this.peer = null;
    this.connection = null;
    this.listeners = [];
    this.roomId = this.getOrCreateRoomId();
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
    
    // Load PeerJS dynamically if not present
    this.loadPeerJS(() => {
      this.peer = new Peer(peerId);

      this.peer.on('open', (id) => {
        console.log('[RemoteControl] OBS Receiver Peer initialized with ID:', id);
        if (onReadyCallback) onReadyCallback(this.roomId);
      });

      this.peer.on('connection', (conn) => {
        console.log('[RemoteControl] Mobile controller connected!');
        this.connection = conn;
        conn.on('data', (data) => {
          this.notifyListeners(data);
          // Echo back to local BroadcastChannel as well
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

  // Dispatch an action/event to both BroadcastChannel and Peer connection
  send(action, payload = {}) {
    const message = { action, payload, timestamp: Date.now() };

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
