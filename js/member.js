// 速來得網購團購網 - 會員資料頁面邏輯

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = `form-msg show ${type}`;
}

function renderMemberView(member) {
  document.getElementById("guest-panel").style.display = "none";
  document.getElementById("member-panel").style.display = "block";

  document.getElementById("member-name-display").textContent = member.name || "會員您好";
  document.getElementById("member-email-display").textContent = member.email;
  document.getElementById("member-level-display").textContent = member.member_level || "一般會員";
  document.getElementById("member-points-display").textContent = member.points ?? 0;

  document.getElementById("profile-name").value = member.name || "";
  document.getElementById("profile-phone").value = member.phone || "";
  document.getElementById("profile-address").value = member.address || "";
}

function renderGuestView() {
  document.getElementById("guest-panel").style.display = "block";
  document.getElementById("member-panel").style.display = "none";
}

async function handleSignup(email, password, name) {
  if (!supabaseClient) {
    const fakeMember = { id: crypto.randomUUID(), email, name, member_level: "一般會員", points: 0 };
    saveMember(fakeMember);
    return { member: fakeMember };
  }

  const { data: authData, error: authError } = await supabaseClient.auth.signUp({ email, password });
  if (authError) return { error: authError.message };

  // Supabase 為防止 email 列舉攻擊，若信箱已被註冊，會回傳一個不存在於 auth.users 的假使用者物件
  if (!authData.user || authData.user.identities?.length === 0) {
    return { error: "此信箱已經註冊過，請改用「會員登入」。" };
  }

  const { data: memberRow, error: memberError } = await supabaseClient
    .from("frozen_members")
    .upsert(
      { auth_user_id: authData.user.id, email, name },
      { onConflict: "email" }
    )
    .select()
    .single();

  if (memberError) return { error: memberError.message };
  return { member: memberRow };
}

async function handleLogin(email, password) {
  if (!supabaseClient) {
    return { error: "本站示範模式尚未連線資料庫，請改用註冊功能建立本機會員。" };
  }

  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (authError) return { error: authError.message };

  let { data: memberRow, error: memberError } = await supabaseClient
    .from("frozen_members")
    .select("*")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  // 帳號已存在於 auth.users（例如其他服務曾用同一信箱註冊），但尚未建立本站的會員資料，首次登入時自動補上
  if (!memberError && !memberRow) {
    const created = await supabaseClient
      .from("frozen_members")
      .upsert(
        { auth_user_id: authData.user.id, email, name: email.split("@")[0] },
        { onConflict: "email" }
      )
      .select()
      .single();
    memberRow = created.data;
    memberError = created.error;
  }

  if (memberError) return { error: memberError.message };
  return { member: memberRow };
}

async function handleUpdateProfile(member, updates) {
  const merged = { ...member, ...updates };
  saveMember(merged);

  if (supabaseClient && member.id) {
    await supabaseClient.from("frozen_members").update(updates).eq("id", member.id);
  }
  return merged;
}

function initMemberPage() {
  const existingMember = getMember();
  if (existingMember) {
    renderMemberView(existingMember);
  } else {
    renderGuestView();
  }

  const tabs = document.querySelectorAll(".auth-tabs button");
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.target;
      loginForm.style.display = target === "login" ? "block" : "none";
      signupForm.style.display = target === "signup" ? "block" : "none";
    });
  });

  const loginMsg = document.getElementById("login-msg");
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const result = await handleLogin(email, password);
    if (result.error) {
      showMsg(loginMsg, result.error, "error");
    } else {
      saveMember(result.member);
      showMsg(loginMsg, "登入成功！", "success");
      renderMemberView(result.member);
    }
  });

  const signupMsg = document.getElementById("signup-msg");
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const result = await handleSignup(email, password, name);
    if (result.error) {
      showMsg(signupMsg, result.error, "error");
    } else {
      showMsg(signupMsg, "註冊成功！歡迎加入速來得會員。", "success");
      renderMemberView(result.member);
    }
  });

  const profileForm = document.getElementById("profile-form");
  const profileMsg = document.getElementById("profile-msg");
  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const member = getMember();
    const updates = {
      name: document.getElementById("profile-name").value.trim(),
      phone: document.getElementById("profile-phone").value.trim(),
      address: document.getElementById("profile-address").value.trim()
    };
    const merged = await handleUpdateProfile(member, updates);
    renderMemberView(merged);
    showMsg(profileMsg, "會員資料已更新！", "success");
  });

  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", async () => {
    if (supabaseClient) await supabaseClient.auth.signOut();
    clearMember();
    renderGuestView();
  });
}

document.addEventListener("DOMContentLoaded", initMemberPage);
