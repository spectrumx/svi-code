import { VisualizationStateDetail } from '../apiClient/visualizationService';
import { Capture, FileMetadata } from '../apiClient/fileService';

export interface FileWithData extends FileMetadata {
  fileData: any;
}

export type FilesWithData = {
  [key: string]: FileWithData;
};

export interface VizContainerProps {
  visualizationState: VisualizationStateDetail;
  files: FilesWithData;
}
