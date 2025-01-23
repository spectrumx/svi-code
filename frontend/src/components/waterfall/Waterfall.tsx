import _ from 'lodash';

import {
  Application,
  Display,
  ScanOptionsType,
  Chart,
  WaterfallType,
  PeriodogramType,
  DataPoint,
  FloatArray,
  binaryStringToFloatArray,
  formatHertz,
} from './index';

interface WaterfallProps {
  data: PeriodogramType;
  currentApplication: Application;
  scanDisplay: Display;
  setScanDisplay: (display: Display) => void;
  scanOptions: ScanOptionsType;
  setScanOptions: (options: ScanOptionsType) => void;
  chart: Chart;
  setChart: (chart: Chart) => void;
  waterfall: WaterfallType;
  setWaterfall: (waterfall: WaterfallType) => void;
}

function Waterfall({ data }: WaterfallProps) {
  return <div>Waterfall</div>;
}

export { Waterfall };
