/* ====== CẤU HÌNH APP – chỉ cần sửa file này ======
   Lấy các giá trị trong Supabase: Project Settings → API.
   (anon key là khóa công khai, để ở đây không sao: dữ liệu vẫn được khóa bằng mã của họ.) */
window.APP_CONFIG = {
  tenHo: 'Họ Nguyễn Duy',
  supabaseUrl: 'https://udoyhnlwngwwljcagdlw.supabase.co',
  supabaseAnonKey: '',    // anon key (eyJ...) hoặc publishable key (sb_publishable_...)
  vapidPublicKey: 'BJGOTgqY2MpP-0f31OsKxt9G8ZGsiIB54t7XnKCg8bAUz7zCSqiVKQfjxoAjS_gZU9aExanwNxA361tCcdbSEr8'  // khóa công khai để gửi thông báo nhắc giỗ (đã tạo sẵn)
};
