import { Redirect } from 'expo-router';

// confirm.tsx は active.tsx に統合されました。
// 古いリンク経由でのアクセスはホームにリダイレクトします。
export default function ConfirmRedirect() {
  return <Redirect href="/" />;
}
