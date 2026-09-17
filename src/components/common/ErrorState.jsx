export default function ErrorState({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="error-state">
      {error.message || String(error)}
      {onRetry && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 12 }}
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}
