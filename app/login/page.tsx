import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { loginAction, resetPassword } from '@/app/actions';

export const metadata = { title: 'Войти', robots: { index: false, follow: false } };

export default function Login() {
  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-mark">154</div>
        <span className="eyebrow">Личный кабинет</span>
        <h1>С возвращением</h1>
        <p className="lead">Войдите, чтобы сохранять вакансии, получать уведомления и управлять откликами.</p>

        <div className="auth-switch" aria-label="Действие с аккаунтом">
          <Link className="auth-choice active" href="/login">
            <strong>Войти</strong>
            <span>У меня уже есть аккаунт</span>
          </Link>
          <Link className="auth-choice" href="/register">
            <strong>Зарегистрироваться</strong>
            <span>Создать новый аккаунт</span>
          </Link>
        </div>

        <ActionForm action={loginAction} label="Войти">
          <input type="hidden" name="mode" value="login" />
          <label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.org" /></label>
          <label>Пароль<input name="password" type="password" required minLength={10} maxLength={128} autoComplete="current-password" placeholder="Введите пароль" /></label>
        </ActionForm>

        <details className="auth-reset">
          <summary>Забыли пароль?</summary>
          <ActionForm action={resetPassword} label="Отправить письмо">
            <label>Email<input name="email" type="email" required placeholder="you@example.org" /></label>
          </ActionForm>
        </details>
      </div>
    </section>
  );
}
