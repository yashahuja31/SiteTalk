document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const currentUrlElement = document.getElementById('currentUrl');
    const messageCountElement = document.getElementById('messageCount');
    const onlineCountElement = document.getElementById('onlineCount');
    const openChatBtn = document.getElementById('openChatBtn');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const settingsBtn = document.getElementById('settingsBtn');

    // Get current tab URL
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        const url = new URL(currentTab.url);
        const domain = url.hostname;
        currentUrlElement.textContent = domain;
        
        // Get message count for this domain
        chrome.storage.local.get([domain], function(result) {
            const messages = result[domain] || [];
            messageCountElement.textContent = messages.length;
        });
    });

    // Open chat window
    openChatBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            // First check if we can communicate with the content script
            chrome.tabs.sendMessage(tabs[0].id, {action: "ping"}, function(response) {
                if (chrome.runtime.lastError) {
                    // Content script not ready, inject it
                    chrome.scripting.executeScript({
                        target: {tabId: tabs[0].id},
                        files: ['content.js']
                    }, function() {
                        // Now try to open chat after a short delay
                        setTimeout(function() {
                            chrome.tabs.sendMessage(tabs[0].id, {action: "openChat"});
                            window.close();
                        }, 100);
                    });
                } else {
                    // Content script is ready
                    chrome.tabs.sendMessage(tabs[0].id, {action: "openChat"});
                    window.close();
                }
            });
        });
    });

    // Clear chat history
    clearChatBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all chat history for this site?')) {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                const currentTab = tabs[0];
                const url = new URL(currentTab.url);
                const domain = url.hostname;
                
                // Clear messages for this domain
                chrome.storage.local.remove(domain, function() {
                    messageCountElement.textContent = '0';
                    // Try to send message, but don't worry if it fails
                    try {
                        chrome.tabs.sendMessage(tabs[0].id, {action: "clearChat"});
                    } catch (e) {
                        console.log("Content script not available");
                    }
                });
            });
        }
    });

    // Settings button
    settingsBtn.addEventListener('click', function() {
        // This will be implemented later
        alert('Settings coming soon!');
    });

    // Update online count (this would be more dynamic with a real backend)
    function updateOnlineCount() {
        // For now, we'll simulate 1-5 random users
        const randomUsers = Math.floor(Math.random() * 5) + 1;
        onlineCountElement.textContent = randomUsers;
    }
    
    // Update online count every 10 seconds
    updateOnlineCount();
    setInterval(updateOnlineCount, 10000);
});