// @ts-ignore
import CanvasJSReact from '@canvasjs/react-charts';
import { ChartOptions } from 'canvasjs';

const { CanvasJSChart } = CanvasJSReact;

interface PeriodogramProps {
  chart: ChartOptions;
}

function Periodogram({ chart }: PeriodogramProps) {
  return (
    <div id="chartCanvas" className="border" style={{ width: '100%' }}>
      <CanvasJSChart options={chart} />
    </div>
  );
}

export { Periodogram };
