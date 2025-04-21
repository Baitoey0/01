document.addEventListener('DOMContentLoaded', () => {
  const pages = {
    home: document.getElementById('home-page'),
    login: document.getElementById('login-page'),
    feed: document.getElementById('feed-page'),
    profile: document.getElementById('profile-page'),
    search: document.getElementById('search-page'),
    anonSend: document.getElementById('anon-send-page')
  };

  const messagesContainer = pages.feed.querySelector('.messages');
  let selectedAvatarColor = '#c3e7f8';
  let currentUser = '';

  function showPage(name) {
    Object.values(pages).forEach(p => p.style.display = 'none');
    pages[name].style.display = 'block';
    if (name === 'feed' || name === 'profile') updateAvatarDisplay();
    if (name === 'feed') loadMessages();
  }

  function updateAvatarDisplay() {
    fetch(`/api/user/${currentUser}`)
      .then(res => res.json())
      .then(user => {
        document.querySelectorAll('.avatar').forEach(a => a.style.background = user.avatarColor);
        document.querySelector('.avatar-large').style.background = user.avatarColor;
        document.querySelectorAll('.username').forEach(el => el.textContent = currentUser);
      });
  }

  function loadMessages() {
    fetch(`/api/user/${currentUser}`)
      .then(res => res.json())
      .then(user => {
        messagesContainer.innerHTML = '';
        if (user.messages && user.messages.length) {
          // Sort messages - pinned first
          user.messages.forEach((msg, i) => addMessageToFeed(msg, i));
        } else {
          messagesContainer.innerHTML = '<div class="message-card"><p>ยังไม่มีข้อความ</p></div>';
        }
      });
  }

  function escapeHTML(str) {
    return str.replace(/[&<>"']/g, match => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;'
    })[match]);
  }

  function addMessageToFeed(text, index) {
    const card = document.createElement('div');
    card.className = 'message-card';
    card.innerHTML = `
      <p class="message-text">${escapeHTML(text)}</p>
      <div class="actions">
        <button class="heart-btn">💬 Reply</button>
        <button class="pin-btn" data-index="${index}">📌 Pin</button>
        <button class="delete-btn" data-index="${index}"><i class="fas fa-trash"></i></button>
      </div>
      <div class="replies-container" style="margin-top: 10px;"></div>
      <div class="reply-input-container" style="display: none;">
        <input type="text" class="reply-input" placeholder="Type a reply...">
        <button class="send-reply-btn" data-index="${index}">Send Reply</button>
      </div>
    `;
    messagesContainer.prepend(card);
    addCardActions(card);
  }

  function addCardActions(card) {
    card.querySelector('.heart-btn').addEventListener('click', () => {
      const replyContainer = card.querySelector('.reply-input-container');
      replyContainer.style.display = replyContainer.style.display === 'none' ? 'block' : 'none';
    });

    card.querySelector('.pin-btn').addEventListener('click', (e) => {
      const index = e.target.closest('button').dataset.index;
      fetch(`/api/pin/${currentUser}/${index}`, { method: 'PUT' })
        .then(res => res.json())
        .then(data => {
          if (data.isPinned) {
            card.classList.add('pinned');
            const parent = card.parentElement;
            const pinnedCards = parent.querySelectorAll('.message-card.pinned');
            parent.insertBefore(card, pinnedCards[0] || parent.firstChild);
          } else {
            card.classList.remove('pinned');
          }
        });
    });

    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      const index = e.target.closest('button').dataset.index;
      fetch(`/api/message/${currentUser}/${index}`, { method: 'DELETE' })
        .then(() => {
          alert('ลบข้อความสำเร็จ!');
          loadMessages();
        });
    });

    card.querySelector('.send-reply-btn').addEventListener('click', (e) => {
      const replyInput = card.querySelector('.reply-input');
      const replyText = replyInput.value.trim();
      const messageIndex = e.target.dataset.index;
      
      if (replyText === '') return;

      fetch(`/api/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: currentUser, 
          messageIndex: messageIndex,
          reply: replyText 
        })
      }).then(() => {
        const replyContainer = card.querySelector('.replies-container');
        const replyMessage = document.createElement('div');
        replyMessage.className = 'reply-message';
        replyMessage.textContent = `Reply: ${escapeHTML(replyText)}`;
        replyContainer.appendChild(replyMessage);
        replyInput.value = '';
      });
    });
  }

  // Avatar picker
  document.querySelectorAll('.avatar-choice').forEach(choice => {
    choice.addEventListener('click', () => {
      document.querySelectorAll('.avatar-choice').forEach(c => c.classList.remove('selected'));
      choice.classList.add('selected');
      selectedAvatarColor = choice.dataset.color;
    });
  });

  // Navigation Events
  document.getElementById('go-login').addEventListener('click', () => {
    showPage('login');
  });

  document.getElementById('back-home').addEventListener('click', () => {
    showPage('home');
  });

  document.getElementById('go-profile').addEventListener('click', () => {
    showPage('profile');
  });

  document.getElementById('back-feed').addEventListener('click', () => {
    showPage('feed');
  });

  document.getElementById('go-search').addEventListener('click', () => {
    showPage('search');
  });

  document.getElementById('back-home-from-search').addEventListener('click', () => {
    showPage('home');
  });

  // Search functionality
  document.getElementById('search-btn').addEventListener('click', () => {
    const searchUsername = document.getElementById('search-username').value.trim();
    if (!searchUsername) return alert('กรุณาใส่ชื่อผู้ใช้ที่ต้องการค้นหา');

    fetch(`/api/search/${searchUsername}`)
      .then(res => res.json())
      .then(users => {
        if (users.length === 0) {
          return alert('ไม่พบผู้ใช้');
        }
        // Show first user for simplicity
        document.getElementById('target-username').textContent = users[0].username;
        showPage('anonSend');
      });
  });

  // Send anonymous message
  document.getElementById('anon-send-btn').addEventListener('click', () => {
    const targetUsername = document.getElementById('target-username').textContent;
    const message = document.getElementById('anon-message').value.trim();
    
    if (!message) return alert('กรุณาเขียนข้อความ');

    fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUsername, message })
    }).then(res => {
      if (res.ok) {
        alert('ส่งข้อความสำเร็จ!');
        document.getElementById('anon-message').value = '';
        showPage('home');
      } else {
        alert('เกิดข้อผิดพลาดในการส่งข้อความ');
      }
    });
  });

  // Login
  document.getElementById('login-btn').addEventListener('click', () => {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    if (!username || !password) return alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');

    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, avatarColor: selectedAvatarColor })
    })
    .then(res => {
      if (!res.ok) throw new Error('Login failed');
      return res.json();
    })
    .then(data => {
      currentUser = username;
      showPage('feed');
    })
    .catch(err => {
      alert('การเข้าสู่ระบบล้มเหลว: ' + err.message);
    });
  });

  // Profile send
  document.getElementById('send-btn').addEventListener('click', () => {
    if (!currentUser) {
      alert('คุณต้องเข้าสู่ระบบก่อน');
      return showPage('login');
    }
    
    const message = document.getElementById('message-input').value.trim();
    if (!message) return alert('กรุณากรอกข้อความ');
    
    // ส่งข้อความหาตัวเอง
    fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUsername: currentUser, message })
    }).then(res => {
      if (res.ok) {
        alert('ส่งข้อความสำเร็จ!');
        document.getElementById('message-input').value = '';
      } else {
        alert('เกิดข้อผิดพลาดในการส่งข้อความ');
      }
    });
  });

  // Log out
  document.getElementById('logout-btn').addEventListener('click', () => {
    currentUser = '';
    showPage('home');
  });

  // Start with home page
  showPage('home');
});