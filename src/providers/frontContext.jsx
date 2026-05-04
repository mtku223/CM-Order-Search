import { createContext, useContext, useEffect, useState } from "react";
import Front from "@frontapp/plugin-sdk";
import PropTypes from "prop-types";

/*
 * Context.
 */

export const FrontContext = createContext();

/*
 * Hook.
 */

// eslint-disable-next-line react-refresh/only-export-components
export function useFrontContext() {
  return useContext(FrontContext);
}

/*
 * Component.
 */

export const FrontContextProvider = ({ children }) => {
  const [context, setContext] = useState();

  useEffect(() => {
    const subscription = Front.contextUpdates.subscribe((frontContext) => {
      setContext(frontContext);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <FrontContext.Provider value={context}>{children}</FrontContext.Provider>
  );
};

FrontContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
