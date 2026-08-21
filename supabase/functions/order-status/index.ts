// 速來得網購團購網 - 查詢單筆訂單付款狀態（供 payment-result.html 輪詢使用）
// 只回傳付款結果頁需要顯示的最少欄位，不回傳姓名/電話/地址等個資，
// 且完全不依賴前端 anon key 對 frozen_orders 的讀取權限（該權限已被 RLS 收回）。
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const orderId = url.searchParams.get("id");
  if (!orderId) return jsonResponse({ error: "MissingOrderId" }, 400);

  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/frozen_orders?id=eq.${encodeURIComponent(orderId)}&select=id,total,payment_status,payment_method,ecpay_rtn_msg`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );

  if (!resp.ok) return jsonResponse({ error: "QueryFailed" }, 500);
  const [order] = await resp.json();
  if (!order) return jsonResponse({ error: "NotFound" }, 404);

  return jsonResponse({ order });
});
