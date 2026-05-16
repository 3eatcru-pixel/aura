import React, { createContext, useContext, useState } from 'react';
const WalletContext = createContext<any>(null);
export const useWallet = () => useContext(WalletContext);
export const WalletProvider = ({ children }: any) => {
  const [balance, setBalance] = useState(0);
  return <WalletContext.Provider value={{ balance, setBalance }}>{children}</WalletContext.Provider>;
}
