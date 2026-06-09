'use client';

import { Download } from 'lucide-react';

interface ExportButtonProps {
  section: string;
  label: string;
  onExport: (section: string) => void;
  isAdminOrAgent: boolean;
}

export default function ExportButton({ section, label, onExport, isAdminOrAgent }: ExportButtonProps) {
  if (!isAdminOrAgent) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
      <button
        onClick={() => onExport(section)}
        className="btn btn-secondary btn-sm"
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <Download size={13} /> Export {label}
      </button>
    </div>
  );
}
