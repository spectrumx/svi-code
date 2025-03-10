import { createContext, useContext, useState, ReactNode } from 'react';

import { FileMetadata, Capture } from '../apiClient/fileService';

interface AppContextModel {
  username?: string;
  setUsername: (value: string | undefined) => void;
  files: FileMetadata[];
  setFiles: (value: FileMetadata[]) => void;
  captures: Capture[];
  setCaptures: (value: Capture[]) => void;
}

const AppContext = createContext<AppContextModel | undefined>(undefined);

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [username, setUsername] = useState<string>();
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);

  return (
    <AppContext.Provider
      value={{
        username,
        setUsername,
        files,
        setFiles,
        captures,
        setCaptures,
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
