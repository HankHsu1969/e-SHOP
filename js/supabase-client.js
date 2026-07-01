// 速來得網購團購網 - Supabase 連線設定
const SUPABASE_URL = "https://cbaapxvsgaqsogqijtzo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_K9TzIv9bFvsbPJvYKrIBlQ_fz5dkiAv";

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
