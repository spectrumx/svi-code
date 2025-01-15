import { createContext, useContext, useState, ReactNode } from 'react';

import { SigMFFilePair } from '../apiClient/fileService';

interface AppContextModel {
  username?: string;
  setUsername: (value: string | undefined) => void;
  captures: SigMFFilePair[];
  setCaptures: (value: SigMFFilePair[]) => void;
}

const AppContext = createContext<AppContextModel | undefined>(undefined);

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [username, setUsername] = useState<string>();
  const [captures, setCaptures] = useState<SigMFFilePair[]>([]);

  return (
    <AppContext.Provider
      value={{ username, setUsername, captures, setCaptures }}
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
