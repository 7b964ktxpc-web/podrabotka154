import type { Metadata } from 'next';
import Link from 'next/link';
import { appUrl } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: 'Подработка 154: подработка в Новосибирске', template: '%s | Подработка 154' },
  description: 'Разовые смены и временная работа в Новосибирске. Найдите объявление, откройте адрес и свяжитесь с работодателем.',
  openGraph: { locale: 'ru_RU', type: 'website', siteName: 'Подработка 154' },
};

export const dynamic = 'force-dynamic';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body>
    <header>
      <div className="wrap">
        <Link href="/" className="brand" aria-label="Подработка 154 — на главную">подработка<span>154</span></Link>
        <nav aria-label="Основное меню">
          <Link href="/jobs">Найти работу</Link>
          <Link href="/favorites">Избранное</Link>
          <Link href="/profile">Кабинет</Link>
          <Link className="button primary" href="/jobs/new">+ Разместить</Link>
        </nav>
      </div>
    </header>
    <main className="wrap">{children}</main>
    <footer>
      <div className="wrap">
        <div className="row"><b>Подработка 154</b><span>Поиск для соискателей — бесплатно</span><Link href="/employer">Работодателям</Link><Link href="/privacy">Конфиденциальность</Link></div>
        <p>Не переводите предоплату за трудоустройство. Проверяйте условия и работодателя до начала работы.</p>
      </div>
    </footer>
  </body></html>;
}
