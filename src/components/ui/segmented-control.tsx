export default function SegmentedControl<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return <div className="segmented" role="group" aria-label={label}>
    {options.map((option) => (
      <button key={option.value} className={option.value === value ? "selected" : ""} onClick={() => onChange(option.value)}>
        {option.label}
      </button>
    ))}
  </div>;
}
