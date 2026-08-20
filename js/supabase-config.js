// مهرآیین - اتصال به Supabase
// این کلید Publishable است و برای استفاده در مرورگر طراحی شده است.
const SUPABASE_URL = "https://vsrvqlthnefsmdtqjfml.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_g5L_wvVm7183vk-6vMSBAA_hC12OTc_";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
