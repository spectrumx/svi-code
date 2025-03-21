interface SpectrogramVisualizationProps {
  imageUrl: string | null;
  hasError: boolean;
}

/**
 * Renders a spectrogram visualization or placeholder based on provided image URL
 * @param imageUrl - URL of the spectrogram image to display
 * @param hasError - Whether there was an error generating the spectrogram
 */
const SpectrogramVisualization = ({
  imageUrl,
  hasError,
}: SpectrogramVisualizationProps) => {
  return (
    <div
      style={{
        width: '100%',
        height: 500,
        backgroundColor: imageUrl && !hasError ? 'transparent' : '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Spectrogram visualization"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            aspectRatio: window.innerWidth / window.innerHeight,
            objectFit: 'contain',
          }}
        />
      ) : (
        <p className="text-muted">
          {hasError
            ? 'Failed to generate spectrogram'
            : 'Generate a spectrogram using the controls'}
        </p>
      )}
    </div>
  );
};

export { SpectrogramVisualization };
