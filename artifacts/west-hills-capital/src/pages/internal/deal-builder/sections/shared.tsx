interface FieldProps {
  label:        string;
  value:        string;
  onChange:     (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?:    boolean;
  type?:        string;
  placeholder?: string;
}

export function Field({ label, value, onChange, disabled, type = "text", placeholder }: FieldProps) {
  return (
    <div>
      {label && <label className="block text-xs text-gray-400 mb-1">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 disabled:opacity-60"
      />
    </div>
  );
}
