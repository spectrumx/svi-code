import LoadingSpinner from './LoadingSpinner';

interface LoadingBlockProps {
  message?: string;
}

const LoadingBlock = ({ message = 'Loading...' }: LoadingBlockProps) => {
  return (
    <div className="d-flex flex-column align-items-center">
      <div className="me-2">
        <LoadingSpinner />
      </div>
      <div>{message}</div>
    </div>
  );
};

export default LoadingBlock;
