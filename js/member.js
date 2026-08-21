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

// 若該登入的 auth 使用者在 frozen_members 尚無對應資料列，自動補建一筆
// （常見於：帳號已存在於 auth.users 但首次登入本站，或透過 Google OAuth 首次登入）
async function ensureMemberRow(authUser) {
  const email = authUser.email;
  const { data: existing, error: selectError } = await supabaseClient
    .from("frozen_members")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (selectError) return { error: selectError.message };
  if (existing) return { member: existing };

  const fallbackName =
    authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split("@")[0];

  const { data: created, error: insertError } = await supabaseClient
    .from("frozen_members")
    .upsert({ auth_user_id: authUser.id, email, name: fallbackName }, { onConflict: "email" })
    .select()
    .single();

  if (insertError) return { error: insertError.message };
  return { member: created };
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

  return ensureMemberRow(authData.user);
}

async function handleGoogleLogin() {
  if (!supabaseClient) {
    return { error: "本站示範模式尚未連線資料庫，無法使用 Google 登入。" };
  }
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/member.html` }
  });
  if (error) return { error: error.message };
  return {};
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

  const googleBtn = document.getElementById("google-login-btn");
  googleBtn.addEventListener("click", async () => {
    googleBtn.disabled = true;
    const result = await handleGoogleLogin();
    if (result.error) {
      showMsg(loginMsg, result.error, "error");
      googleBtn.disabled = false;
    }
    // 成功時瀏覽器會被導向 Google，這裡不需要再做事
  });

  // 從 Google 授權導回本頁時，Supabase 會觸發 SIGNED_IN；重新整理已登入的分頁則會先收到 INITIAL_SESSION
  if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        const result = await ensureMemberRow(session.user);
        if (result.member) {
          saveMember(result.member);
          renderMemberView(result.member);
        }
      } else if (event === "SIGNED_OUT") {
        clearMember();
        renderGuestView();
      }
    });
  }

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
