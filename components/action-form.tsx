"use client";
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionState } from '@/app/actions';
import { Button } from './ui/button';
export function Submit({ children = 'Сохранить', disabled = false }: {
    children?: React.ReactNode;
    disabled?: boolean;
}) { const { pending } = useFormStatus(); return <Button disabled={pending || disabled}>{pending ? 'Сохраняем…' : children}</Button>; }
export function ActionForm({ action, children, label = 'Сохранить', disabled = false }: {
    action: (state: ActionState, form: FormData) => Promise<ActionState>;
    children: React.ReactNode;
    label?: string;
    disabled?: boolean;
}) { const [state, formAction] = useActionState(action, {}); return <form action={formAction}>{children}{state.error && <p role="alert" className="message error">{state.error}</p>}{state.ok && <p role="status" className="message">{state.ok}</p>}<Submit disabled={disabled}>{label}</Submit></form>; }
