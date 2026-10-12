import { cloneElement, useId, type ReactElement } from 'react';
import type { Taxon } from '../shared/schema';
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ 'aria-labelledby'?: string }>;
}) {
  const labelId = useId();
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      {cloneElement(children, { 'aria-labelledby': labelId })}
    </label>
  );
}
export function TaxonSelect({
  label,
  value,
  onChange,
  items,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: Taxon[];
  optional?: boolean;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{optional ? 'None' : 'Select ' + label.toLowerCase()}</option>
        {items.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.isTest ? ' (test taxonomy)' : ''}
          </option>
        ))}
      </select>
    </Field>
  );
}
