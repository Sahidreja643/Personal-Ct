// Initialize Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();

// Hide Loading Screen after 1.2 seconds
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
    }, 1200);

    // Load Telegram User Data if available
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        const user = tg.initDataUnsafe.user;
        document.getElementById('user-profile-name').innerText = `${user.first_name} ${user.last_name || ''}`;
        if (user.photo_url) {
            document.getElementById('user-profile-pic').src = user.photo_url;
            document.getElementById('my-status-avatar').src = user.photo_url;
        }
    }
});

// Bottom Navigation Switching
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        tabContents.forEach(tab => tab.classList.remove('active'));

        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
    });
});

// Search Bar Toggle
const searchToggleBtn = document.getElementById('search-toggle-btn');
const searchBarContainer = document.getElementById('search-bar-container');
const closeSearchBtn = document.getElementById('close-search');

searchToggleBtn.addEventListener('click', () => {
    searchBarContainer.classList.toggle('hidden');
});

closeSearchBtn.addEventListener('click', () => {
    searchBarContainer.classList.add('hidden');
});

// Dark Mode Toggle
const themeToggleBtn = document.getElementById('theme-toggle-btn');
themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const icon = themeToggleBtn.querySelector('i');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
});

// Open & Close Chat Window
function openChat(name, avatar, status) {
    document.getElementById('chat-header-name').innerText = name;
    document.getElementById('chat-header-avatar').src = avatar;
    document.getElementById('chat-header-status').innerText = status;
    document.getElementById('chat-window').classList.remove('hidden');

    // Telegram BackButton support
    tg.BackButton.show();
    tg.BackButton.onClick(closeChat);
}

function closeChat() {
    document.getElementById('chat-window').classList.add('hidden');
    tg.BackButton.hide();
}

// Send Demo Message in UI
const sendMsgBtn = document.getElementById('send-msg-btn');
const messageInput = document.getElementById('message-input');
const messagesArea = document.getElementById('messages-area');

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message sent';
    msgDiv.innerHTML = `<p>${text}</p><span class="msg-time">${timeStr} <i class="fas fa-check"></i></span>`;

    messagesArea.appendChild(msgDiv);
    messageInput.value = '';
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

sendMsgBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
