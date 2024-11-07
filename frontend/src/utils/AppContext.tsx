import { createContext, useContext, useState, ReactNode } from 'react';

interface AppContextModel {
  username?: string;
  setUsername: (value: string | undefined) => void;
}

const AppContext = createContext<AppContextModel | undefined>(undefined);

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [username, setUsername] = useState<string>();

  return (
    <AppContext.Provider value={{ username, setUsername }}>
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
