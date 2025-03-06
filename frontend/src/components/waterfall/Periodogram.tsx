// @ts-ignore
import CanvasJSReact from '@canvasjs/react-charts';
import { ChartOptions } from 'canvasjs';

const { CanvasJSChart } = CanvasJSReact;

interface PeriodogramProps {
  chartOptions: ChartOptions;
  chartContainerStyle?: React.CSSProperties;
  yAxisTitle?: string;
}

function Periodogram({
  chartOptions,
  chartContainerStyle,
  yAxisTitle,
}: PeriodogramProps) {
  const yAxisOptions = chartOptions.axisY;
  const plotLeftMargin =
    yAxisOptions && !Array.isArray(yAxisOptions)
      ? (yAxisOptions.margin ?? 10)
      : 10;

  return (
    <div
      id="chartCanvas"
      className="border"
      style={{ width: '100%', position: 'relative' }}
    >
      {yAxisTitle && (
        <div
          style={{
            position: 'absolute',
            left: plotLeftMargin - 10,
            top: '40%',
            transform: 'rotate(-90deg) translateX(-50%)',
            transformOrigin: 'left center',
            whiteSpace: 'nowrap',
            zIndex: 1,
          }}
          aria-label={`Y-axis title: ${yAxisTitle}`}
        >
          <span style={{ margin: 0, fontSize: '1.2rem' }}>{yAxisTitle}</span>
        </div>
      )}
      <CanvasJSChart
        options={chartOptions}
        containerProps={chartContainerStyle}
      />
    </div>
  );
}

export { Periodogram };
