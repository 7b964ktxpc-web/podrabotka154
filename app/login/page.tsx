import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { loginAction, resetPassword } from '@/app/actions';

export const metadata = { title: 'Войти', robots: { index: false, follow: false } };

export default function Login() {
  return <section className="auth-shell">
    <div className="auth-copy">
      <p className="eyebrow">Подработка 154</p>
      <h1>Всё для поиска работы — в одном аккаунте</h1>
      <p className="lead">Сохраняйте вакансии, получайте уведомления и размещайте свои объявления, если вы работодатель.</p>
      <div className="auth-benefits">
        <div><b>♡</b><span><strong>Избранное</strong><small>Не теряйте подходящие смены.</small></span></div>
        <div><b>⌕</b><span><strong>Сохранённые поиски</strong><small>Быстрее находите нужную подработку.</small></span></div>
        <div><b>▣</b><span><strong>Работодатель</strong><small>Размещайте и управляйте вакансиями.</small></span></div>
      </div>
    </div>
    <div className="auth-card panel">
      <div className="auth-card-brand"><Link href="/" className="brand">подработка<span>154</span></Link></div>
      <p className="eyebrow">Личный кабинет</p>
      <h2>Войти или зарегистрироваться</h2>
      <p className="small muted">Один аккаунт подходит и соискателям, и работодателям.</p>
      <ActionForm action={loginAction} label="Продолжить">
        <label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.org" /></label>
        <label>Пароль<input name="password" type="password" required minLength={10} maxLength={128} autoComplete="current-password" placeholder="Минимум 10 символов" /><small>Не меньше 10 символов.</small></label>
        <label>Действие<select name="mode"><option value="login">Войти</option><option value="signup">Зарегистрироваться</option></select></label>
        <p className="small muted">При регистрации потребуется подтверждение email.</p>
      </ActionForm>
      <details className="auth-reset"><summary>Забыли пароль?</summary><ActionForm action={resetPassword} label="Отправить письмо"><label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.org" /></label></ActionForm></details>
      <Link className="auth-back" href="/jobs">← Вернуться к вакансиям</Link>
    </div>
  </section>;
}
