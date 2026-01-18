export default function Tag({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
