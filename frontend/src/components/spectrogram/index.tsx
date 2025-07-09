interface SpectrogramVisualizationProps {
  imageUrl: string | null;
  isLoading: boolean;
  hasError: boolean;
  onSave?: () => void;
}

/**
 * Renders a spectrogram visualization or placeholder based on provided image URL
 * @param imageUrl - URL of the spectrogram image to display
 * @param hasError - Whether there was an error generating the spectrogram
 * @param onSave - Optional callback function to handle saving the spectrogram
 */
const SpectrogramVisualization = ({
  imageUrl,
  isLoading,
  hasError,
  onSave,
}: SpectrogramVisualizationProps) => {
  return (
    <div
      style={{
        width: '100%',
        height: 500,
        backgroundColor: imageUrl && !hasError ? 'transparent' : '#f8f9fa',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt="Spectrogram visualization"
            style={{
              maxWidth: '90%',
              maxHeight: '100%',
              aspectRatio: window.innerWidth / window.innerHeight,
              objectFit: 'contain',
            }}
          />
          {onSave && (
            <button
              className="btn btn-primary position-absolute top-0 end-0 m-0"
              onClick={onSave}
              aria-label="Export Spectrogram"
            >
              <i className="bi bi-download me-2" />
              Export
            </button>
          )}
        </>
      ) : (
        <p className="text-muted">
          {isLoading
            ? 'Generating spectrogram...'
            : hasError
              ? 'Failed to generate spectrogram'
              : 'Generate a spectrogram using the controls'}
        </p>
      )}
    </div>
  );
};

export { SpectrogramVisualization };
