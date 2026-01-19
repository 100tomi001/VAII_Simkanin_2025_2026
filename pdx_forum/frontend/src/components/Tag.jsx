export default function Tag({ label, active, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={!!active}
      className="tag-pill"
      style={{
        background: active ? "var(--accent)" : "var(--chip-bg)",
        borderColor: active ? "var(--accent)" : "var(--chip-border)",
        color: active ? "#fff" : "var(--text)",
      }}
    >
      {label}
    </button>
  );
}
