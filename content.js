// Global variables
let chatWindow = null;
let chatMessages = [];
let currentDomain = window.location.hostname;
let username = "User" + Math.floor(Math.random() * 1000); // Random username
let port = null; // Connection to background script

// Connect to background script
function connectToBackground() {
    port = chrome.runtime.connect({name: "sitechat"});
    
    // Listen for messages from background script
    port.onMessage.addListener(function(message) {
        if (message.type === 'chat') {
            // Add message to chat
            chatMessages.push(message);
            if (chatWindow) {
                updateChatMessages();
            }
        } else if (message.type === 'userCount') {
            // Update user count if chat window is open
            if (chatWindow) {
                updateOnlineCount(message.count);
            }
        }
    });
}

// Connect when page loads
connectToBackground();

// Listen for messages from popup.js or background.js
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "openChat") {
        openChatWindow();
    } else if (request.action === "clearChat") {
        chatMessages = [];
        if (chatWindow) {
            updateChatMessages();
        }
    }
    return true;
});

// Create and open chat window
function openChatWindow() {
    // If chat window already exists, just show it
    if (chatWindow) {
        chatWindow.style.display = 'block';
        return;
    }

    // Create chat window container
    chatWindow = document.createElement('div');
    chatWindow.id = 'sitechat-window';
    chatWindow.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 320px;
        height: 400px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7);
        border-radius: 10px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    // Create chat header
    const chatHeader = document.createElement('div');
    chatHeader.style.cssText = `
        padding: 12px 15px;
        background-color: rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        user-select: none;
    `;
    
    const chatTitle = document.createElement('div');
    chatTitle.textContent = '💬 SiteChat - ' + currentDomain;
    chatTitle.style.cssText = `
        color: white;
        font-weight: 600;
        font-size: 14px;
    `;
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 16px;
        cursor: pointer;
        padding: 0;
    `;
    closeButton.onclick = function() {
        chatWindow.style.display = 'none';
    };
    
    chatHeader.appendChild(chatTitle);
    chatHeader.appendChild(closeButton);
    chatWindow.appendChild(chatHeader);

    // Create messages container
    const messagesContainer = document.createElement('div');
    messagesContainer.id = 'sitechat-messages';
    messagesContainer.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 15px;
        background-color: rgba(255, 255, 255, 0.1);
    `;
    chatWindow.appendChild(messagesContainer);

    // Create input area
    const inputArea = document.createElement('div');
    inputArea.style.cssText = `
        display: flex;
        padding: 10px;
        background-color: rgba(255, 255, 255, 0.1);
    `;
    
    const messageInput = document.createElement('input');
    messageInput.type = 'text';
    messageInput.placeholder = 'Type a message...';
    messageInput.style.cssText = `
        flex: 1;
        padding: 8px 12px;
        border: none;
        border-radius: 20px;
        margin-right: 8px;
        outline: none;
    `;
    
    const sendButton = document.createElement('button');
    sendButton.textContent = '📤';
    sendButton.style.cssText = `
        background-color: white;
        border: none;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
    `;
    
    const voiceButton = document.createElement('button');
    voiceButton.textContent = '🎤';
    voiceButton.style.cssText = `
        background-color: white;
        border: none;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        margin-right: 8px;
    `;
    
    inputArea.appendChild(messageInput);
    inputArea.appendChild(voiceButton);
    inputArea.appendChild(sendButton);
    chatWindow.appendChild(inputArea);

    // Add to document
    document.body.appendChild(chatWindow);

    // Load existing messages
    loadMessages();

    // Make chat window draggable
    makeDraggable(chatWindow, chatHeader);

    // Add event listeners
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage(messageInput.value);
            messageInput.value = '';
        }
    });

    sendButton.addEventListener('click', function() {
        sendMessage(messageInput.value);
        messageInput.value = '';
    });

    voiceButton.addEventListener('click', function() {
        toggleVoiceRecording(voiceButton);
    });
}

// Make an element draggable
function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        // Get mouse position at startup
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // Call function whenever cursor moves
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        // Calculate new position
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // Set element's new position
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
        element.style.bottom = "auto";
        element.style.right = "auto";
    }

    function closeDragElement() {
        // Stop moving when mouse button is released
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// Send a new message
function sendMessage(text) {
    if (!text.trim()) return;
    
    const message = {
        username: username,
        text: text,
        timestamp: new Date().toISOString(),
        type: 'chat',
        messageType: 'text'
    };
    
    // Add to local messages
    chatMessages.push(message);
    saveMessages();
    updateChatMessages();
    
    // Send to background script for broadcasting to other users
    if (port) {
        port.postMessage(message);
    }
}

// Toggle voice recording
function toggleVoiceRecording(button) {
    // This is a placeholder for voice recording functionality
    // In a real implementation, this would use the Web Audio API
    
    if (button.textContent === '🎤') {
        button.textContent = '⏹️';
        button.style.backgroundColor = '#ff4d4d';
        alert('Voice recording is not implemented in this demo.');
    } else {
        button.textContent = '🎤';
        button.style.backgroundColor = 'white';
    }
}

// Load messages from storage
function loadMessages() {
    chrome.storage.local.get([currentDomain], function(result) {
        if (result[currentDomain]) {
            chatMessages = result[currentDomain];
            updateChatMessages();
        }
    });
}

// Save messages to storage
function saveMessages() {
    // Limit to last 50 messages
    if (chatMessages.length > 50) {
        chatMessages = chatMessages.slice(-50);
    }
    
    const data = {};
    data[currentDomain] = chatMessages;
    chrome.storage.local.set(data);
}

// Update chat messages in the UI
function updateChatMessages() {
    const messagesContainer = document.getElementById('sitechat-messages');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '';
    
    chatMessages.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.style.cssText = `
            margin-bottom: 10px;
            max-width: 80%;
            ${message.username === username ? 'margin-left: auto;' : ''}
        `;
        
        const bubbleElement = document.createElement('div');
        bubbleElement.style.cssText = `
            background-color: ${message.username === username ? 'white' : 'rgba(255, 255, 255, 0.7)'};
            color: ${message.username === username ? '#6366f1' : '#333'};
            border-radius: 18px;
            padding: 8px 12px;
            display: inline-block;
            word-break: break-word;
        `;
        
        const messageType = message.messageType || message.type;
        if (messageType === 'text') {
            bubbleElement.textContent = message.text;
        } else if (messageType === 'voice') {
            // Placeholder for voice messages
            const voiceIcon = document.createElement('span');
            voiceIcon.textContent = '🔊 ';
            bubbleElement.appendChild(voiceIcon);
            
            const voiceText = document.createElement('span');
            voiceText.textContent = 'Voice message';
            bubbleElement.appendChild(voiceText);
        }
        
        const metaElement = document.createElement('div');
        metaElement.style.cssText = `
            font-size: 11px;
            color: rgba(255, 255, 255, 0.7);
            margin-top: 2px;
            ${message.username === username ? 'text-align: right;' : ''}
        `;
        
        const time = new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        metaElement.textContent = `${message.username} • ${time}`;
        
        messageElement.appendChild(bubbleElement);
        messageElement.appendChild(metaElement);
        messagesContainer.appendChild(messageElement);
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Update online user count in the UI
function updateOnlineCount(count) {
    if (!chatWindow) return;
    
    // Find or create the online count element
    let onlineCountElement = document.getElementById('sitechat-online-count');
    if (!onlineCountElement) {
        onlineCountElement = document.createElement('div');
        onlineCountElement.id = 'sitechat-online-count';
        onlineCountElement.style.cssText = `
            position: absolute;
            top: 12px;
            right: 40px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.8);
        `;
        const chatHeader = chatWindow.querySelector('div');
        if (chatHeader) {
            chatHeader.appendChild(onlineCountElement);
        }
    }
    
    onlineCountElement.textContent = `👥 ${count} online`;
}

// Initialize when the page loads
window.addEventListener('load', function() {
    // We don't automatically open the chat window
    // It will be opened when the user clicks the button in the popup
});