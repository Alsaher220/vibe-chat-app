// ====================================
// FIREBASE CONFIGURATION
// ====================================
const firebaseConfig = {
    apiKey: "AIzaSyCU0Agq1CTsKS2YbO-mzXr2jOseQ49bp8k",
    authDomain: "vibechatapp-504eb.firebaseapp.com",
    projectId: "vibechatapp-504eb",
    storageBucket: "vibechatapp-504eb.firebasestorage.app",
    messagingSenderId: "447918097803",
    appId: "1:447918097803:web:b8d23000ff41b915eedb8e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ====================================
// AGORA CONFIGURATION
// ====================================
const AGORA_APP_ID = "3b9822e28fc04a8bbccfc78314fda8f4";
const AGORA_CERTIFICATE = "3be059da007145adbdbe4883f152ce90";

// Admin secret key (change this to whatever you want!)
const ADMIN_SECRET = "vibeadmin123";

// Your pre-recorded video URLs (add your videos here!)
const adminVideoUrls = [
    'video1.mp4',  // Replace with your actual video URLs
    'video2.mp4',
    'video3.mp4'
];

// ====================================
// GLOBAL VARIABLES
// ====================================
let currentUsername = '';
let isAdmin = false;
let unsubscribe = null;
let agoraClient = null;
let localTracks = {
    videoTrack: null,
    audioTrack: null
};
let remoteUsers = {};
let channelName = 'vibe-chat-room';

// ====================================
// LOGIN FUNCTION
// ====================================
function login() {
    const username = document.getElementById('usernameInput').value.trim();
    const adminKey = document.getElementById('adminKeyInput').value.trim();
    
    if (username === '') {
        alert('Please enter your name!');
        return;
    }
    
    // Check if admin
    if (adminKey === ADMIN_SECRET) {
        isAdmin = true;
        document.getElementById('adminBadge').classList.remove('hidden');
    }
    
    currentUsername = username;
    document.getElementById('currentUser').textContent = username;
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('chatSection').classList.remove('hidden');
    
    // Start listening to messages
    loadMessages();
    
    // Initialize Agora
    initializeAgora();
}

// ====================================
// LOGOUT FUNCTION
// ====================================
function logout() {
    if (unsubscribe) {
        unsubscribe();
    }
    
    // Leave Agora channel
    if (agoraClient) {
        agoraClient.leave();
    }
    
    currentUsername = '';
    isAdmin = false;
    document.getElementById('usernameInput').value = '';
    document.getElementById('adminKeyInput').value = '';
    document.getElementById('adminBadge').classList.add('hidden');
    document.getElementById('chatSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
}

// ====================================
// AGORA INITIALIZATION
// ====================================
function initializeAgora() {
    agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
}

// ====================================
// SEND MESSAGE FUNCTION
// ====================================
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const messageText = messageInput.value.trim();
    
    if (messageText === '') {
        return;
    }
    
    db.collection('messages').add({
        text: messageText,
        sender: currentUsername,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        messageInput.value = '';
    })
    .catch((error) => {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    });
}

// Allow Enter key to send message
document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
});

// ====================================
// LOAD MESSAGES FUNCTION
// ====================================
function loadMessages() {
    const messagesDiv = document.getElementById('messages');
    
    unsubscribe = db.collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            messagesDiv.innerHTML = '';
            
            snapshot.forEach((doc) => {
                const message = doc.data();
                displayMessage(message);
            });
            
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });
}

// ====================================
// DISPLAY MESSAGE FUNCTION
// ====================================
function displayMessage(message) {
    const messagesDiv = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    
    const isOwn = message.sender === currentUsername;
    messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
    
    let timeString = 'Just now';
    if (message.timestamp) {
        const date = message.timestamp.toDate();
        timeString = date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    messageDiv.innerHTML = `
        ${!isOwn ? `<div class="message-sender">${message.sender}</div>` : ''}
        <div class="message-content">
            ${message.text}
            <div class="message-time">${timeString}</div>
        </div>
    `;
    
    messagesDiv.appendChild(messageDiv);
}

// ====================================
// VIDEO CALL FUNCTIONS
// ====================================
async function startVideoCall() {
    const videoSection = document.getElementById('videoSection');
    videoSection.classList.remove('hidden');
    
    // Send message that call started
    db.collection('messages').add({
        text: '📹 Started a video call',
        sender: currentUsername,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    if (isAdmin) {
        // ADMIN: Show pre-recorded video (fake live!)
        showAdminFakeVideo();
    } else {
        // REGULAR USER: Start real video call
        await startRealVideoCall();
    }
}

// ====================================
// ADMIN FAKE VIDEO (Pre-recorded)
// ====================================
function showAdminFakeVideo() {
    const fakeVideo = document.getElementById('adminFakeVideo');
    const localVideo = document.getElementById('localVideo');
    
    // Hide real video elements
    localVideo.style.display = 'none';
    
    // Show fake video
    fakeVideo.classList.remove('hidden');
    
    // Pick random pre-recorded video
    const randomVideo = adminVideoUrls[Math.floor(Math.random() * adminVideoUrls.length)];
    fakeVideo.src = randomVideo;
    
    console.log('Admin using pre-recorded video! 😎');
}

// ====================================
// REAL VIDEO CALL (For Regular Users)
// ====================================
async function startRealVideoCall() {
    try {
        // Generate token (in production, get this from your server)
        const token = null; // For testing mode, token is null
        
        // Join channel
        await agoraClient.join(AGORA_APP_ID, channelName, token, currentUsername);
        
        // Create local tracks
        localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
        
        // Play local video
        localTracks.videoTrack.play('localVideo');
        
        // Publish local tracks
        await agoraClient.publish([localTracks.audioTrack, localTracks.videoTrack]);
        
        console.log('Video call started successfully!');
        
        // Listen for remote users
        agoraClient.on('user-published', handleUserPublished);
        agoraClient.on('user-unpublished', handleUserUnpublished);
        
    } catch (error) {
        console.error('Error starting video call:', error);
        alert('Could not start video call. Please check camera/microphone permissions.');
    }
}

// Handle remote user joining
async function handleUserPublished(user, mediaType) {
    await agoraClient.subscribe(user, mediaType);
    
    if (mediaType === 'video') {
        const remoteVideoContainer = document.getElementById('remoteVideos');
        const playerDiv = document.createElement('div');
        playerDiv.id = `player-${user.uid}`;
        playerDiv.className = 'remote-video-player';
        remoteVideoContainer.appendChild(playerDiv);
        
        user.videoTrack.play(`player-${user.uid}`);
    }
    
    if (mediaType === 'audio') {
        user.audioTrack.play();
    }
}

// Handle remote user leaving
function handleUserUnpublished(user) {
    const playerDiv = document.getElementById(`player-${user.uid}`);
    if (playerDiv) {
        playerDiv.remove();
    }
}

// ====================================
// END CALL FUNCTION
// ====================================
async function endCall() {
    const videoSection = document.getElementById('videoSection');
    const fakeVideo = document.getElementById('adminFakeVideo');
    
    videoSection.classList.add('hidden');
    
    if (isAdmin) {
        // Admin: Stop fake video
        fakeVideo.pause();
        fakeVideo.src = '';
        fakeVideo.classList.add('hidden');
        document.getElementById('localVideo').style.display = 'block';
    } else {
        // Regular user: Leave Agora channel
        if (localTracks.audioTrack) {
            localTracks.audioTrack.close();
        }
        if (localTracks.videoTrack) {
            localTracks.videoTrack.close();
        }
        
        // Remove all remote video players
        const remoteVideoContainer = document.getElementById('remoteVideos');
        remoteVideoContainer.innerHTML = '';
        
        if (agoraClient) {
            await agoraClient.leave();
        }
    }
}
