"use client";

export function GabbaiMinyanSwitch({
  names,
  index,
  onChange
}: {
  names: string[];
  index: number;
  onChange: (index: number) => void;
}) {
  if (names.length <= 1) {
    const name = names[0]?.trim();
    return name ? <p className="mb-3 text-sm font-semibold text-[#6b1a2e]">{name}</p> : null;
  }

  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm font-medium">לאיזה מניין?</span>
      <select
        className="h-11 w-full rounded-md border border-border bg-background px-3 text-base"
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {names.map((name, i) => (
          <option key={`${name}-${i}`} value={i}>
            {name.trim() || `מניין ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}
