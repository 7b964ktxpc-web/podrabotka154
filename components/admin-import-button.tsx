"use client";

import { useState } from 'react';

type ImportResult = {
  new?: number;
  error?: string;
};

export function AdminImportButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function runImport() {
    setBusy(true);
    setMessage('Импортируем…');
    try {
      const response = await fetch('/api/telegram/import-public', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Импорт не выполнен');
      }
      const results: ImportResult[] = Array.isArray(data?.results) ? data.results : [];
      const newCount = results.reduce((sum, item) => sum + Number(item.new || 0), 0);
      const failed = results.filter((item) => Boolean(item.error)).length;
      setMessage(
        failed
          ? `Импорт завершён: новых ${newCount}, ошибок ${failed}`
          : `Импорт завершён: новых ${newCount}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Импорт не выполнен');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
      <button className="button" type="button" onClick={runImport} disabled={busy}>
        {busy ? 'Импортируем…' : 'Импорт Telegram ↻'}
      </button>
      {message && <span className="small muted" role="status">{message}</span>}
    </div>
  );
}
