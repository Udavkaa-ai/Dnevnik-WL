import React, { createContext, useContext, useState } from 'react';

const DrawerContext = createContext({ drawerOpen: false, setDrawerOpen: () => {} });

export function DrawerProvider({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <DrawerContext.Provider value={{ drawerOpen, setDrawerOpen }}>
      {children}
    </DrawerContext.Provider>
  );
}

export const useDrawer = () => useContext(DrawerContext);
