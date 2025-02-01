// @ts-ignore
import CanvasJSReact from '@canvasjs/react-charts';

import { Chart } from './types';

const { CanvasJSChart } = CanvasJSReact;

interface PeriodogramProps {
  chart: Chart;
}

function Periodogram({ chart }: PeriodogramProps) {
  return (
    <div id="chartCanvas" className="border" style={{ width: '100%' }}>
      <CanvasJSChart options={chart} />
    </div>
  );
}

export { Periodogram };
