export default function Tag({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tag-pill"
      style={{
        background: active ? "#4f46e5" : "#020617",
        borderColor: active ? "#6366f1" : "#1f2937",
      }}
    >
      {label}
    </button>
  );
}
