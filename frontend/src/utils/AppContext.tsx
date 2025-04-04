import { createContext, useContext, useState, ReactNode } from 'react';

import { FileMetadata } from '../apiClient/fileService';
import { Capture } from '../apiClient/captureService';
import { VisualizationRecord } from '../apiClient/visualizationService';

// undefined means we're trying to fetch user data
// null means not logged in
// string means logged in
type Username = undefined | null | string;

interface AppContextModel {
  username?: Username;
  setUsername: (value: Username) => void;
  files: FileMetadata[];
  setFiles: (value: FileMetadata[]) => void;
  captures: Capture[];
  setCaptures: (value: Capture[]) => void;
  visualizations: VisualizationRecord[];
  setVisualizations: (value: VisualizationRecord[]) => void;
}

const AppContext = createContext<AppContextModel | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [username, setUsername] = useState<Username>(null);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [visualizations, setVisualizations] = useState<VisualizationRecord[]>(
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
