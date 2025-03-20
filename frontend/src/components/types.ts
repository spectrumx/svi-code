import { VisualizationStateDetail } from '../apiClient/visualizationService';
import { FileMetadata } from '../apiClient/fileService';

export interface FileWithContent extends FileMetadata {
  fileContent: unknown;
  isValid?: boolean;
}

export type FilesWithContent = {
  [key: string]: FileWithContent;
};

export interface VizContainerProps {
  visualizationState: VisualizationStateDetail;
  files: FilesWithContent;
}
