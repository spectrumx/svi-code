import { VisualizationRecordDetail } from '../apiClient/visualizationService';
import { FileMetadata } from '../apiClient/fileService';

export interface FileWithContent extends FileMetadata {
  fileContent: unknown;
  isValid?: boolean;
}

/**
 * A dictionary of files with content, indexed by file ID.
 */
export type FilesWithContent = {
  [id: string]: FileWithContent;
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
