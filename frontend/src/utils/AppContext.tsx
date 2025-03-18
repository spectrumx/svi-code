import { createContext, useContext, useState, ReactNode } from 'react';

import { FileMetadata, Capture } from '../apiClient/fileService';
import { VisualizationState } from '../apiClient/visualizationService';

interface AppContextModel {
  username?: string;
  setUsername: (value: string | undefined) => void;
  files: FileMetadata[];
  setFiles: (value: FileMetadata[]) => void;
  captures: Capture[];
  setCaptures: (value: Capture[]) => void;
  visualizations: VisualizationState[];
  setVisualizations: (value: VisualizationState[]) => void;
}

const AppContext = createContext<AppContextModel | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [username, setUsername] = useState<string>();
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [visualizations, setVisualizations] = useState<VisualizationState[]>(
    [],
  );

  return (
    <AppContext.Provider
      value={{
        username,
        setUsername,
        files,
        setFiles,
        captures,
        setCaptures,
        visualizations,
        setVisualizations,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
