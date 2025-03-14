/**
 * A simple loading spinner component using Bootstrap's spinner.
 * Can be customized with different sizes and colors through props.
 */
const LoadingSpinner = () => {
  return (
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  );
};

export default LoadingSpinner;
