import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { loginAction } from '@/app/actions';

export const metadata = { title: 'Регистрация', robots: { index: false, follow: false } };

export default function Register() {
  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-mark">154</div>
        <span className="eyebrow">Новый аккаунт</span>
        <h1>Создать аккаунт</h1>
        <p className="lead">Сохраняйте интересные вакансии, получайте уведомления и размещайте свои объявления.</p>

        <div className="auth-switch" aria-label="Действие с аккаунтом">
          <Link className="auth-choice" href="/login">
            <strong>Войти</strong>
            <span>У меня уже есть аккаунт</span>
          </Link>
          <Link className="auth-choice active" href="/register">
            <strong>Зарегистрироваться</strong>
            <span>Создать новый аккаунт</span>
          </Link>
        </div>

        <ActionForm action={loginAction} label="Создать аккаунт">
          <input type="hidden" name="mode" value="signup" />
          <label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.org" /></label>
          <label>Пароль<input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" placeholder="Не меньше 10 символов" /></label>
          <p className="auth-note">После регистрации потребуется подтвердить email.</p>
        </ActionForm>
      </div>
    </section>
  );
}
