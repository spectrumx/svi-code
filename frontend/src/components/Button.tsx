import {
  OverlayTrigger,
  Tooltip,
  Button as BootstrapButton,
} from 'react-bootstrap';

interface ButtonProps extends React.ComponentProps<typeof BootstrapButton> {
  disabledHelpText?: string;
}

const Button = ({
  disabledHelpText,
  style,
  ...bootstrapButtonProps
}: ButtonProps) => {
  const { disabled } = bootstrapButtonProps;
  const finalStyle = (
    disabled ? { ...style, pointerEvents: 'none' } : style
  ) as React.CSSProperties;

  return (
    <OverlayTrigger
      overlay={<Tooltip id="tooltip-disabled">{disabledHelpText}</Tooltip>}
      // 'undefined' lets the overlay automatically handle visibility
      show={!disabled || !disabledHelpText ? false : undefined}
    >
      <span className="d-inline-block">
        <BootstrapButton {...bootstrapButtonProps} style={finalStyle} />
      </span>
    </OverlayTrigger>
  );
};

export default Button;
