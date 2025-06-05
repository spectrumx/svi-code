import { useRef, useEffect, useState } from 'react';
import _ from 'lodash';
import { scaleLinear, interpolateHslLong, rgb } from 'd3';

import { ScanState, ScanWaterfallType, Display } from './types';
import { WATERFALL_MAX_ROWS } from './index';

const SCROLL_INDICATOR_SIZE = 15;
const WATERFALL_HEIGHT = 500;

const scrollIndicatorStyle: React.CSSProperties = {
  width: 0,
  height: 0,
  borderLeft: `${SCROLL_INDICATOR_SIZE}px solid transparent`,
  borderRight: `${SCROLL_INDICATOR_SIZE}px solid transparent`,
  cursor: 'pointer',
  margin: '0 auto',
  display: 'block',
};

const upIndicatorStyle: React.CSSProperties = {
  ...scrollIndicatorStyle,
  borderBottom: `${SCROLL_INDICATOR_SIZE}px solid #808080`,
};

const downIndicatorStyle: React.CSSProperties = {
  ...scrollIndicatorStyle,
  borderTop: `${SCROLL_INDICATOR_SIZE}px solid #808080`,
};

interface WaterfallPlotProps {
  scan: ScanState;
  display: Display;
  setWaterfall: (waterfall: ScanWaterfallType) => void;
  setScaleChanged: (scaleChanged: boolean) => void;
  setResetScale: (resetScale: boolean) => void;
  currentFileIndex: number;
  onRowSelect: (index: number) => void;
  /**
   * The indices of the files currently being displayed in the waterfall plot.
   * Note that the WaterfallPlot component simply displays whatever files are
   * in scan.allData; this prop just tells the component the indices of those
   * files within the full dataset.
   */
  fileRange: {
    startIndex: number;
    endIndex: number;
  };
  /**
   * The total number of files in the full dataset.
   */
  totalFiles: number;
  /**
   * The width of the legend in pixels, including labels.
   */
  colorLegendWidth: number;
  indexLegendWidth: number;
}

export function WaterfallPlot({
  scan,
  display,
  setWaterfall,
  setScaleChanged,
  setResetScale,
  currentFileIndex,
  onRowSelect,
  fileRange,
  totalFiles,
  colorLegendWidth,
  indexLegendWidth,
}: WaterfallPlotProps) {
  const plotCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const plotDimensionsRef = useRef<{
    rectWidth: number;
    rectHeight: number;
  } | null>(null);
  const pixelRatioRef = useRef(1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Proportion of legend width that is used for the label vs the gradient bar
  const colorbarProportion = 0.2;
  const labelWidth = colorLegendWidth * (1 - colorbarProportion);
  const margin = { top: 5, bottom: 5 };

  // Update canvas sizes on mount
  useEffect(() => {
    if (!plotCanvasRef.current || !overlayCanvasRef.current) return;

    const plotCanvas = plotCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const container = plotCanvas.parentElement;
    if (!container) return;

    // Get the container's width
    const { width } = container.getBoundingClientRect();

    // Set canvas width to match container width, accounting for device pixel ratio
    const pixelRatio = window.devicePixelRatio || 1;
    pixelRatioRef.current = pixelRatio;
    const canvasWidth = Math.floor(width * pixelRatio);
    const canvasHeight = Math.floor(WATERFALL_HEIGHT * pixelRatio);

    // Set dimensions for both canvases
    [plotCanvas, overlayCanvas].forEach((c) => {
      c.width = canvasWidth;
      c.height = canvasHeight;
      c.style.width = `${width}px`;
      c.style.height = `${WATERFALL_HEIGHT}px`;

      // Position the canvases
      c.style.position = 'absolute';
      c.style.left = '0';
      c.style.top = '0';

      // Adjust canvas context for high DPI displays
      const context = c.getContext('2d');
      if (context) {
        context.scale(pixelRatio, pixelRatio);
        // Clear any existing transformations
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      }
    });

    // Ensure overlay canvas is on top
    overlayCanvas.style.zIndex = '1';
  }, []);

  function drawHighlightBox(
    context: CanvasRenderingContext2D,
    allData: number[][],
    boxIndex: number,
    rectWidth: number,
    rectHeight: number,
    strokeStyle: string,
  ) {
    const pixelRatio = pixelRatioRef.current;

    context.save();
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.translate(colorLegendWidth, margin.top);

    const rowFromBottom = allData.length - 1 - boxIndex;
    const boxY = Math.floor(rowFromBottom * rectHeight);
    const boxWidth = Math.ceil(allData[0].length * rectWidth);

    context.strokeStyle = strokeStyle;
    context.lineWidth = 2;
    context.strokeRect(0, boxY, boxWidth, rectHeight);

    context.restore();
  }

  function drawHighlightBoxes(
    allData: number[][],
    currentIndex: number,
    rectWidth: number,
    rectHeight: number,
    hoverIndex: number | null = null,
  ) {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;

    const context = overlayCanvas.getContext('2d');
    if (!context) return;

    // Clear the entire overlay canvas including the transformed area
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    context.restore();

    // Calculate the relative position within the current page
    const relativeIndex = currentIndex - fileRange.startIndex;

    // Only draw if the current index is within the displayed range
    if (relativeIndex >= 0 && relativeIndex < allData.length) {
      drawHighlightBox(
        context,
        allData,
        relativeIndex,
        rectWidth,
        rectHeight,
        'black',
      );
    }

    if (hoverIndex !== null) {
      const relativeHoverIndex = hoverIndex - fileRange.startIndex;

      if (relativeHoverIndex >= 0 && relativeHoverIndex < allData.length) {
        drawHighlightBox(
          context,
          allData,
          relativeHoverIndex,
          rectWidth,
          rectHeight,
          'grey',
        );
      }
    }
  }

  function drawFileIndices(
    context: CanvasRenderingContext2D,
    allData: number[][],
    rectHeight: number,
    canvasWidth: number,
    pixelRatio: number,
    hoveredIndex: number | null = null,
  ) {
    // Reset transform for drawing indices
    context.save();
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    // Create white background for indices
    context.fillStyle = 'white';
    context.fillRect(
      canvasWidth / pixelRatio - indexLegendWidth,
      0,
      indexLegendWidth,
      allData.length * rectHeight + margin.top + margin.bottom,
    );

    // Only draw indices if we have 5 or more rows
    if (allData.length >= 5) {
      context.font = '12px Arial';
      context.textAlign = 'left';

      // Show every 5th index
      for (let i = fileRange.endIndex; i >= fileRange.startIndex; i--) {
        const displayedIndex = i + 1;
        const row = fileRange.endIndex - i;
        const y = margin.top + row * rectHeight;
        const x = canvasWidth / pixelRatio - indexLegendWidth + 5;

        // Determine if this index should be highlighted
        const isHovered = hoveredIndex !== null && i === hoveredIndex;

        if (displayedIndex % 5 === 0 || isHovered) {
          context.fillStyle = isHovered ? 'grey' : 'black';
          context.fillText(String(displayedIndex), x, y);
        }
      }
    }

    context.restore();
  }

  function drawWaterfall(
    canvas: HTMLCanvasElement,
    resetScaleCallback: () => void,
  ) {
    const scanCopy = _.cloneDeep(scan);
    const displayCopy = _.cloneDeep(display);
    const allData = scanCopy.allData;
    let redrawLegend = false;

    if (allData && allData.length > 0) {
      const context = canvas.getContext('2d');
      if (!context) return;

      const pixelRatio = pixelRatioRef.current;

      // Calculate available space for plotting
      const plotWidth =
        canvas.width / pixelRatio - colorLegendWidth - indexLegendWidth;
      const plotHeight =
        canvas.height / pixelRatio - margin.top - margin.bottom;

      // Calculate rectangle dimensions to fit exactly
      const rectWidth = plotWidth / allData[0].length;
      const rectHeight = plotHeight / WATERFALL_MAX_ROWS;

      // Store dimensions for highlight box
      plotDimensionsRef.current = { rectWidth, rectHeight };

      let { yMin, yMax } = scanCopy;
      const { scaleMin, scaleMax } = displayCopy;

      let colorScale =
        scaleMin && scaleMax
          ? scaleLinear(
              [scaleMin, scaleMax],
              [rgb('#0000FF'), rgb('#FF0000')],
            ).interpolate(interpolateHslLong)
          : // .interpolate(d3.interpolate)
            // .interpolate(d3.interpolateHcl)
            undefined;

      if (displayCopy.resetScale && context) {
        // Rescale the color gradient to min/max values and redraw entire graph

        // The following block of code clears the entire canvas without
        // losing context information.
        // Store the current transformation matrix
        context.save();
        // Use the identity matrix while clearing the canvas
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        // Restore the transform
        context.restore();

        //console.log("old ymin/max:",yMin,yMax);
        allData.forEach((row) => {
          row.forEach((value) => {
            if (yMin === undefined || value < yMin) {
              yMin = value;
            }
            if (yMax === undefined || value > yMax) {
              yMax = value;
            }
          });
        });
        //console.log("new ymin/max:",yMin,yMax);

        //waterfall.display.scaleMin = Math.round(yMin * 100) / 100;
        //waterfall.display.scaleMax = Math.round(yMax * 100) / 100;
        displayCopy.scaleMin = yMin;
        displayCopy.scaleMax = yMax;
        if (yMin < scanCopy.yMin) {
          scanCopy.yMin = yMin;
        }
        if (yMax > scanCopy.yMax) {
          scanCopy.yMax = yMax;
        }

        setWaterfall(scanCopy);

        colorScale = scaleLinear(
          [displayCopy.scaleMin, displayCopy.scaleMax],
          [rgb('#0000FF'), rgb('#FF0000')],
        ).interpolate(interpolateHslLong);

        // context.translate(labelWidth + margin.left, margin.top + 5);

        // console.log('allData before draw:', allData);
        if (colorScale) {
          allData.forEach((row, rowIndex) => {
            row.forEach((value, colIndex) => {
              // console.log('Drawing allDatacanvas square:', colIndex, value);
              drawCanvasSquare(
                context,
                colIndex,
                value,
                rowIndex,
                colorScale!,
                rectWidth,
                rectHeight,
              );
            });
          });
        } else {
          console.error('Color scale is undefined');
        }

        resetScaleCallback();
        redrawLegend = true;
      }

      if (
        (isCanvasBlank(canvas) || redrawLegend || displayCopy.scaleChanged) &&
        context
      ) {
        // Draw the color legend
        context.save();
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        // Create white background for legend
        context.fillStyle = 'white';
        context.fillRect(0, margin.top, labelWidth, plotHeight);

        const barWidth = colorLegendWidth * colorbarProportion;
        const barX = 0;
        const barY = margin.top;
        const labelX = barX + barWidth + 8;
        const totalRange =
          (displayCopy.scaleMax ?? 0) - (displayCopy.scaleMin ?? -130);

        // Create a linear gradient
        const gradient = context.createLinearGradient(
          0,
          barY,
          0,
          barY + plotHeight,
        );

        // Add color stops at regular intervals
        const numStops = 10; // Number of color stops for smooth gradient

        for (let i = 0; i <= numStops; i++) {
          const fraction = i / numStops;
          const dbVal = (displayCopy.scaleMax ?? 0) - fraction * totalRange;
          const color = colorScale?.(dbVal) ?? 'black';
          gradient.addColorStop(fraction, color);
        }

        // Draw the gradient
        context.fillStyle = gradient;
        context.fillRect(barX, barY, barWidth, plotHeight);

        // Draw labels at 5 dB intervals
        context.font = '12px Arial';
        context.textAlign = 'left';
        context.fillStyle = 'black';

        const dbStep = 5; // Draw label every 5 dB
        const maxDb = Math.ceil((displayCopy.scaleMax ?? 0) / dbStep) * dbStep;
        const minDb =
          Math.floor((displayCopy.scaleMin ?? -130) / dbStep) * dbStep;

        // Draw dB value labels with units
        for (let dbVal = maxDb; dbVal >= minDb; dbVal -= dbStep) {
          const fraction = ((displayCopy.scaleMax ?? 0) - dbVal) / totalRange;
          const y = margin.top + fraction * plotHeight;

          // Only draw if within the gradient bounds
          if (y >= margin.top && y <= margin.top + plotHeight) {
            context.fillText(`${dbVal} dBm`, labelX, y + 4);
          }
        }

        // Restore the transform
        context.restore();
        setScaleChanged(false);
      }

      if (context) {
        if (colorScale) {
          // Save the current transform
          context.save();

          // Apply the correct transform for the main plot
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          context.translate(colorLegendWidth, margin.top);

          // Draw all data points in reverse order
          allData.forEach((row, rowIndex) => {
            // Flip the row index
            const rowFromBottom = allData.length - 1 - rowIndex;
            row.forEach((value, colIndex) => {
              drawCanvasSquare(
                context,
                colIndex,
                value,
                rowFromBottom,
                colorScale!,
                rectWidth,
                rectHeight,
              );
            });
          });

          // Restore the transform
          context.restore();
        } else {
          console.error('Color scale is undefined');
        }

        // Draw file indices after drawing the waterfall
        drawFileIndices(
          context,
          allData,
          rectHeight,
          canvas.width,
          pixelRatio,
          hoveredIndex,
        );
      }
    }
  }

  useEffect(() => {
    if (plotCanvasRef.current) {
      drawWaterfall(plotCanvasRef.current, () => setResetScale(false));
    }
  }, [scan, display]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !plotDimensionsRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const { rectHeight } = plotDimensionsRef.current;

    // Calculate clicked row
    const allData = scan.allData;
    const clickedRow = Math.floor((y - margin.top) / rectHeight);
    const clickedIndex = allData.length - 1 - clickedRow;

    // Validate the index is within bounds
    if (clickedIndex >= 0 && clickedIndex < allData.length) {
      onRowSelect(fileRange.startIndex + clickedIndex);
    }
  };

  const handleCanvasMouseMove = (
    event: React.MouseEvent<HTMLCanvasElement>,
  ) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !plotDimensionsRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const { rectHeight } = plotDimensionsRef.current;

    // Calculate hovered row
    const hoveredRow = Math.floor((y - margin.top) / rectHeight);
    const hoveredIndex = fileRange.endIndex - 1 - hoveredRow;

    // Update hover state if within bounds
    if (
      hoveredIndex >= fileRange.startIndex &&
      hoveredIndex < fileRange.endIndex
    ) {
      setHoveredIndex(hoveredIndex);
    } else {
      setHoveredIndex(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredIndex(null);
  };

  // Draw highlight boxes and file indices
  useEffect(() => {
    const dimensions = plotDimensionsRef.current;
    const allData = scan.allData;

    if (dimensions && allData && allData.length > 0) {
      // Draw selection highlight
      drawHighlightBoxes(
        allData,
        currentFileIndex,
        dimensions.rectWidth,
        dimensions.rectHeight,
        hoveredIndex,
      );

      const canvas = plotCanvasRef.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        if (context) {
          drawFileIndices(
            context,
            allData,
            dimensions.rectHeight,
            canvas.width,
            pixelRatioRef.current,
            hoveredIndex,
          );
        }
      }
    }
  }, [hoveredIndex, currentFileIndex, scan.allData, fileRange]);

  const indicatorContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: `${SCROLL_INDICATOR_SIZE + 5}px`,
    marginLeft: colorLegendWidth,
    marginRight: indexLegendWidth,
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={indicatorContainerStyle}>
        {fileRange.endIndex < totalFiles && (
          <div
            style={upIndicatorStyle}
            title="More recent scans above"
            onClick={() => {
              const newIndex = Math.min(totalFiles - 1, fileRange.endIndex);
              onRowSelect(newIndex);
            }}
          />
        )}
      </div>
      <div style={{ position: 'relative', height: `${WATERFALL_HEIGHT}px` }}>
        <canvas ref={plotCanvasRef} style={{ display: 'block' }} />
        <canvas
          ref={overlayCanvasRef}
          style={{ display: 'block', cursor: 'pointer' }}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
        />
      </div>
      <div style={indicatorContainerStyle}>
        {fileRange.startIndex > 0 && (
          <div
            style={downIndicatorStyle}
            title="Older scans below"
            onClick={() => {
              const newIndex = Math.max(0, fileRange.startIndex - 1);
              onRowSelect(newIndex);
            }}
          />
        )}
      </div>
    </div>
  );
}

function drawCanvasSquare(
  ctx: CanvasRenderingContext2D,
  xValue: number,
  yValue: number,
  yPos: number,
  colorScale: (value: number) => string | CanvasGradient | CanvasPattern,
  rectWidth: number,
  rectHeight: number,
) {
  const adjustedWidth = Math.ceil(rectWidth); // Ensure we don't get gaps
  const adjustedHeight = Math.ceil(rectHeight);
  ctx.fillStyle = colorScale(yValue);
  ctx.fillRect(
    Math.floor(xValue * rectWidth), // Prevent fractional positioning
    Math.floor(yPos * rectHeight),
    adjustedWidth,
    adjustedHeight,
  );
}

function isCanvasBlank(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas context is null');

  const pixelBuffer = new Uint32Array(
    context.getImageData(0, 0, canvas.width, canvas.height).data.buffer,
  );
  return !pixelBuffer.some((color) => color !== 0);
}
