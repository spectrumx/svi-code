import { VisualizationRecordDetail } from '../apiClient/visualizationService';
import { FileMetadata } from '../apiClient/fileService';

export interface FileWithContent extends FileMetadata {
  fileContent: unknown;
  isValid?: boolean;
}

export type FilesWithContent = {
  [key: string]: FileWithContent;
};

/**
 * Props for Viz Container components (e.g. WaterfallVizContainer,
 * SpectrogramVizContainer, etc.) All Viz Container components should have
 * these exact props, whereas Viz components (e.g. WaterfallVisualization,
 * SpectrogramVisualization, etc.) can have different props, depending on what
 * a particular visualization needs.
 */
export interface VizContainerProps {
  visualizationRecord: VisualizationRecordDetail;
  files: FilesWithContent;
}
