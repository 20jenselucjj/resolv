'use client';
import { ReactNode, useId } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
  className?: string;
}

export function FormField({
  label,
  error,
  required,
  children,
  hint,
  className = '',
}: FormFieldProps) {
  const fieldId = useId();
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = hint ? `${fieldId}-hint` : undefined;

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        htmlFor={fieldId}
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-secondary)',
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
      </label>
      <div aria-invalid={!!error} aria-describedby={[errorId, hintId].filter(Boolean).join(' ')}>
        {children}
      </div>
      {hint && !error && (
        <p
          id={hintId}
          style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}
        >
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          style={{ margin: 0, fontSize: 12, color: 'var(--danger)', lineHeight: 1.4 }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Higher-order component: wraps an input element with FormField.
 * Usage: <FormField label="Email" error={errors.email}><input type="email" /></FormField>
 */
export default FormField;
