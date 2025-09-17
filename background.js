// SiteChat Background Script
// Handles connections, storage, and synchronization

// Initialize connection tracking
let connections = {};
let userCount = {};

// Listen for connections from content scripts
chrome.runtime.onConnect.addListener(function(port) {
    if (port.name !== "sitechat") return;
    
    // Extract domain from the sender's URL
    const sender = port.sender;
    const url = new URL(sender.url);
    const domain = url.hostname;
    
    // Track this connection
    if (!connections[domain]) {
        connections[domain] = [];
    }
    connections[domain].push(port);
    
    // Update user count for this domain
    userCount[domain] = connections[domain].length;
    
    // Notify all connections on this domain about the updated user count
    broadcastUserCount(domain);
    
    // Listen for messages from this port
    port.onMessage.addListener(function(message) {
        // Handle different message types
        if (message.type === 'chat') {
            // Broadcast chat message to all connections on this domain
            broadcastMessage(domain, message, port);
        }
    });
    
    // Handle disconnection
    port.onDisconnect.addListener(function() {
        // Remove this connection
        if (connections[domain]) {
            const index = connections[domain].indexOf(port);
            if (index !== -1) {
                connections[domain].splice(index, 1);
            }
            
            // Update user count
            userCount[domain] = connections[domain].length;
            
            // Clean up if no connections left for this domain
            if (connections[domain].length === 0) {
                delete connections[domain];
                delete userCount[domain];
            } else {
                // Notify remaining users about the updated count
                broadcastUserCount(domain);
            }
        }
    });
});

// Broadcast a message to all connections on a domain
function broadcastMessage(domain, message, senderPort) {
    if (!connections[domain]) return;
    
    // Add timestamp if not present
    if (!message.timestamp) {
        message.timestamp = new Date().toISOString();
    }
    
    // Store message in local storage (limited to last 50)
    storeMessage(domain, message);
    
    // Send to all connections except the sender
    connections[domain].forEach(function(port) {
        if (port !== senderPort) {
            port.postMessage(message);
        }
    });
}

// Broadcast user count to all connections on a domain
function broadcastUserCount(domain) {
    if (!connections[domain]) return;
    
    const count = userCount[domain] || 0;
    const message = {
        type: 'userCount',
        count: count
    };
    
    connections[domain].forEach(function(port) {
        port.postMessage(message);
    });
}

// Store message in local storage
function storeMessage(domain, message) {
    chrome.storage.local.get([domain], function(result) {
        let messages = result[domain] || [];
        messages.push(message);
        
        // Limit to last 50 messages
        if (messages.length > 50) {
            messages = messages.slice(-50);
        }
        
        // Save back to storage
        const data = {};
        data[domain] = messages;
        chrome.storage.local.set(data);
    });
}

// Listen for installation
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === "install") {
        // First-time installation
        console.log("SiteChat installed successfully!");
    } else if (details.reason === "update") {
        // Extension updated
        console.log("SiteChat updated to version " + chrome.runtime.getManifest().version);
    }
});