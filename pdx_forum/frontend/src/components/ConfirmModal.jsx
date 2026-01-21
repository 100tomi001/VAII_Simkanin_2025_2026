export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const confirmStyle =
    confirmVariant === "danger"
      ? { background: "#ef4444", borderColor: "#ef4444" }
      : confirmVariant === "success"
      ? { background: "#10b981", borderColor: "#10b981" }
      : {};

  return (
    <div className="confirm-backdrop" role="dialog" aria-modal="true">
      <div className="confirm-modal">
        {title && <h2 className="confirm-title">{title}</h2>}
        {message && <p className="confirm-message">{message}</p>}
        <div className="confirm-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className="btn-primary"
            style={confirmStyle}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
