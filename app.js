
const SUPABASE_URL = "https://xcbezhomtqnwrbhonwgu.supabase.co";
const SUPABASE_KEY = "sb_publishable_cla-OecF7u1pa30Rf5M9gg_LQQ_7ERR";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentProfile = null;
let activeFriend = null;
let realtimeChannel = null;
let searchTimer = null;

const $ = id => document.getElementById(id);

function message(element, text) {
  $(element).textContent = text;
}

function playSound() {
  if ($("buttonSoundToggle")?.checked === false) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.09);
    oscillator.onended = () => ctx.close();
  } catch (e) {
    console.log("Sound unavailable");
  }
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.hidden = page.id !== pageId;
  });

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });

  playSound();
}

async function signUp() {
  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || password.length < 6) {
    message("authMessage", "সঠিক Email এবং অন্তত ৬ অক্ষরের Password দিন।");
    return;
  }

  const { error } = await db.auth.signUp({
    email,
    password
  });

  if (error) {
    message("authMessage", error.message);
  } else {
    message("authMessage", "Account তৈরি হয়েছে। Email confirmation চাইলে সেটি সম্পূর্ণ করে Login করুন।");
  }
}

async function login() {
  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    message("authMessage", "Email ও Password লিখুন।");
    return;
  }

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    message("authMessage", error.message);
  }
}

async function logout() {
  if (realtimeChannel) {
    await db.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  await db.auth.signOut();
  location.reload();
}

async function loadProfile() {
  const { data, error } = await db
    .from("chat_profiles")
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error("Profile পাওয়া যায়নি। Database-এর profile trigger পরীক্ষা করুন।");
  }

  currentProfile = data;
  updateProfileScreen();
}

function updateProfileScreen() {
  $("profileName").textContent = currentProfile.display_name || "PinkTalk User";
  $("profileUsername").textContent = "@" + (currentProfile.username || "");
  $("editName").value = currentProfile.display_name || "";
  $("editUsername").value = currentProfile.username || "";
  $("editBio").value = currentProfile.bio || "";
}

async function saveProfile() {
  const username = $("editUsername").value
    .trim()
    .toLowerCase()
    .replace(/^@/, "");

  const displayName = $("editName").value.trim();
  const bio = $("editBio").value.trim();

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    message("profileMessage", "Username ৩-২৪ অক্ষরের হতে হবে। শুধু ইংরেজি অক্ষর, সংখ্যা ও _ ব্যবহার করুন।");
    return;
  }

  if (!displayName) {
    message("profileMessage", "আপনার নাম লিখুন।");
    return;
  }

  const { data, error } = await db
    .from("chat_profiles")
    .update({
      username,
      display_name: displayName,
      bio
    })
    .eq("user_id", currentUser.id)
    .select()
    .single();

  if (error) {
    message("profileMessage", error.code === "23505"
      ? "এই Username অন্য কেউ ব্যবহার করছে।"
      : error.message);
    return;
  }

  currentProfile = data;
  updateProfileScreen();
  message("profileMessage", "Profile সফলভাবে আপডেট হয়েছে।");
  playSound();
}

async function searchUsers() {
  const term = $("userSearch").value
    .trim()
    .replace(/^@/, "")
    .toLowerCase();

  const results = $("searchResults");
  results.innerHTML = "";

  if (term.length < 2) return;

  const { data, error } = await db
    .from("chat_profiles")
    .select("user_id, username, display_name, avatar_url, bio")
    .ilike("username", term + "%")
    .neq("user_id", currentUser.id)
    .limit(15);

  if (error) {
    results.textContent = "Search করা যায়নি: " + error.message;
    return;
  }

  if (!data.length) {
    results.textContent = "কোনো ব্যবহারকারী পাওয়া যায়নি।";
    return;
  }

  data.forEach(user => {
    const item = document.createElement("div");
    item.className = "search-result";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "💗";

    const info = document.createElement("div");
    info.className = "chat-info";

    const name = document.createElement("strong");
    name.textContent = user.display_name || "PinkTalk User";

    const username = document.createElement("p");
    username.textContent = "@" + user.username;

    info.append(name, username);
    item.append(avatar, info);

    item.addEventListener("click", () => openChat(user));
    results.appendChild(item);
  });
}

async function openChat(friend) {
  activeFriend = friend;

  $("chatName").textContent = friend.display_name || "Friend";
  $("chatUsername").textContent = "@" + friend.username;
  $("chatAvatar").textContent = "💗";

  $("chatsPage").hidden = true;
  $("profilePage").hidden = true;
  $("settingsPage").hidden = true;
  $("chatPage").hidden = false;

  $("searchResults").innerHTML = "";
  $("userSearch").value = "";

  await loadMessages();
  subscribeMessages();
}

async function loadMessages() {
  if (!activeFriend) return;

  const area = $("messages");
  area.innerHTML = "<p>Loading messages...</p>";

  const { data, error } = await db
    .from("chat_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeFriend.user_id}),and(sender_id.eq.${activeFriend.user_id},receiver_id.eq.${currentUser.id})`
    )
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    area.textContent = "Messages লোড করা যায়নি: " + error.message;
    return;
  }

  area.innerHTML = "";

  data.forEach(renderMessage);
  area.scrollTop = area.scrollHeight;
}

function renderMessage(msg) {
  const area = $("messages");

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (msg.sender_id === currentUser.id) {
    bubble.classList.add("mine");
  }

  const body = document.createElement("div");
  body.textContent = msg.body;

  const time = document.createElement("small");
  time.textContent = new Date(msg.created_at).toLocaleTimeString(
    "bn-BD",
    { hour: "2-digit", minute: "2-digit" }
  );

  bubble.append(body, time);
  area.appendChild(bubble);
}

async function sendMessage(event) {
  event.preventDefault();

  if (!activeFriend) return;

  const body = $("messageInput").value.trim();
  if (!body) return;

  $("messageInput").value = "";

  const { error } = await db
    .from("chat_messages")
    .insert({
      sender_id: currentUser.id,
      receiver_id: activeFriend.user_id,
      body
    });

  if (error) {
    $("messageInput").value = body;
    alert("Message পাঠানো যায়নি: " + error.message);
    return;
  }

  playSound();
  await loadMessages();
}

function subscribeMessages() {
  if (realtimeChannel) {
    db.removeChannel(realtimeChannel);
  }

  realtimeChannel = db
    .channel("pinktalk-live-" + currentUser.id)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages"
      },
      payload => {
        const msg = payload.new;

        const belongsToChat = activeFriend &&
          (
            (msg.sender_id === currentUser.id &&
             msg.receiver_id === activeFriend.user_id) ||
            (msg.sender_id === activeFriend.user_id &&
             msg.receiver_id === currentUser.id)
          );

        if (belongsToChat) {
          loadMessages();
        } else if (msg.receiver_id === currentUser.id) {
          if ($("soundToggle").checked) {
            playSound();
          }
          if (Notification.permission === "granted") {
            new Notification("PinkTalk 💗", {
              body: "আপনার নতুন মেসেজ এসেছে।"
            });
          }
        }
      }
    )
    .subscribe();
}

async function startApp(user) {
  currentUser = user;

  $("authSection").hidden = true;
  $("mainSection").hidden = false;

  try {
    await loadProfile();
    await loadChatList();
    subscribeMessages();
  } catch (error) {
    alert(error.message);
  }
}

async function loadChatList() {
  const list = $("chatList");
  list.innerHTML = "<p>Loading chats...</p>";

  const { data, error } = await db
    .from("chat_messages")
    .select("sender_id, receiver_id, body, created_at")
    .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    list.textContent = "Chat list লোড করা যায়নি: " + error.message;
    return;
  }

  const ids = [...new Set(data.map(msg =>
    msg.sender_id === currentUser.id
      ? msg.receiver_id
      : msg.sender_id
  ))];

  list.innerHTML = "";

  if (!ids.length) {
    list.textContent = "এখনও কোনো Chat নেই। Username Search করে বন্ধু খুঁজুন।";
    return;
  }

  const { data: profiles, error: profileError } = await db
    .from("chat_profiles")
    .select("user_id, username, display_name")
    .in("user_id", ids);

  if (profileError) {
    list.textContent = "Profile লোড করা যায়নি।";
    return;
  }

  ids.forEach(id => {
    const friend = profiles.find(p => p.user_id === id);
    if (!friend) return;

    const last = data.find(m =>
      m.sender_id === id || m.receiver_id === id
    );

    const item = document.createElement("div");
    item.className = "chat-item";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "💗";

    const info = document.createElement("div");
    info.className = "chat-info";

    const name = document.createElement("strong");
    name.textContent = friend.display_name || "Friend";

    const preview = document.createElement("p");
    preview.textContent = last?.body || "Start chatting";

    info.append(name, preview);
    item.append(avatar, info);
    item.addEventListener("click", () => openChat(friend));

    list.appendChild(item);
  });
}

// Buttons and navigation

$("signupBtn").addEventListener("click", signUp);
$("loginBtn").addEventListener("click", login);
$("logoutBtn").addEventListener("click", logout);
$("saveProfileBtn").addEventListener("click", saveProfile);
$("messageForm").addEventListener("submit", sendMessage);

$("userSearch").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(searchUsers, 350);
});

$("backBtn").addEventListener("click", () => {
  $("chatPage").hidden = true;
  $("chatsPage").hidden = false;
  activeFriend = null;
  loadChatList();
});

$("settingsBtn").addEventListener("click", () => {
  showPage("settingsPage");
});

$("newChatBtn").addEventListener("click", () => {
  $("userSearch").focus();
});

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    showPage(btn.dataset.page);
  });
});

$("darkToggle").addEventListener("change", event => {
  document.body.classList.toggle("dark", event.target.checked);
});

$("soundToggle").addEventListener("change", () => {
  playSound();
});

$("buttonSoundToggle").addEventListener("change", () => {
  playSound();
});

$("languageSelect").addEventListener("change", event => {
  if (event.target.value !== "bn") {
    alert("এই ভাষার অনুবাদ পরবর্তী ধাপে যুক্ত করা হবে।");
    event.target.value = "bn";
  }
});

document.addEventListener("click", event => {
  if (event.target.closest("button")) {
    playSound();
  }
});

async function initialize() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    console.error(error);
    return;
  }

  if (data.session) {
    await startApp(data.session.user);
  }

  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session) {
      startApp(session.user);
    }
  });
}

initialize();
      
