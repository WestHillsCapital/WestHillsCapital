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
      {label && <label className="block text-xs text-[#6B7A99] mb-1">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-white border border-[#D4C9B5] rounded px-3 py-1.5 text-sm text-[#0F1C3F] placeholder-[#B0C0D8] focus:outline-none focus:border-[#C49A38] disabled:opacity-60"
      />
    </div>
  );
}
