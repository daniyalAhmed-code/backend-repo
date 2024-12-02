import { createContext, useCallback, useContext, useEffect, useState } from "react";

export const RBACUsersContext = createContext();

export const RBACUsersProvider = ({ children }) => {
    const [superUsers, setSuperUsers] = useState([]);

  const fetch = useCallback(() => {
    try{
        // fetch('https://mobile.highqfit.com/labelstudio_svc/list_admin_users')
        //     .then(res => res.json())
        //     .then(data => {
        //         setSuperUsers(data['admin']);
        //         // cbSetData?.(data['admin'])
        //     });
    }
    catch(err) {
        console.error('ERROR while fetching RBAC users: ', err);
    }
    // finally{
    //     if(cbLoading) cbLoading?.(false);
    // }
  }, []);

//   useEffect(() => {
    // fetch();
//   }, [fetch]);

  return (
    <RBACUsersContext.Provider value={{ superUsers, fetch }}>
      {children}
    </RBACUsersContext.Provider>
  );
};

export const useRBACUsers = () => useContext(RBACUsersContext);
