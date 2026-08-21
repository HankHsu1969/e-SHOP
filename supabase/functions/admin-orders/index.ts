// 速來得網購團購網 - 後台訂單儀表板專用 API
// dashboard.html 不再直接用 anon key 讀寫 frozen_orders（該權限已被 RLS 收回），
// 改成呼叫這支 Function，並帶上通行碼於 x-admin-passcode 標頭驗證。
// 注意：這仍是輕量級的展示用驗證，非正式的帳號權限系統，正式上線前應改為 Supabase Auth + 角色控管。
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PASSCODE = "sulaide2026";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-passcode",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const restHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.headers.get("x-admin-passcode") !== ADMIN_PASSCODE) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  if (req.method === "GET") {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/frozen_orders?select=*,frozen_order_items(*)&order=created_at.desc`,
      { headers: restHeaders },
    );
    if (!resp.ok) return jsonResponse({ error: "QueryFailed" }, 500);
    const orders = await resp.json();
    return jsonResponse({ orders });
  }

  if (req.method === "PATCH") {
    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "InvalidJSON" }, 400);
    }
    const { order_id, status } = payload as { order_id?: string; status?: string };
    const ALLOWED_STATUS = ["待處理", "已出貨", "已完成", "已取消"];
    if (!order_id || !ALLOWED_STATUS.includes(status || "")) {
      return jsonResponse({ error: "InvalidPayload" }, 400);
    }

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/frozen_orders?id=eq.${encodeURIComponent(order_id)}`, {
      method: "PATCH",
      headers: { ...restHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ status }),
    });
    if (!resp.ok) return jsonResponse({ error: "UpdateFailed" }, 500);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "MethodNotAllowed" }, 405);
});
