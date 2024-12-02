import { fetchAdminsList } from 'RBAC';
import React, { useEffect } from 'react';

type Store = {
  project: unknown,
}
type Context = {
  store: Store,
  update: (data: Partial<Store>) => void,
  fetchAdminUsers: () => void,
}

const AppStoreContext = React.createContext<Context>({} as Context);
AppStoreContext.displayName = 'AppStoreContext';

export const AppStoreProvider: React.FunctionComponent = ({children}) => {
  const [store, setStore] = React.useState({ adminsList: [] } as unknown as Store);

  const update = React.useCallback((newData: Partial<Store>) => {
    setStore({...store, ...(newData ?? {})});
  }, [store]);

  const fetchAdminUsers =  (cb=null as unknown as any) => {
    try{
        // fetch('https://mobile.highqfit.com/labelstudio_svc/list_admin_users')
        //     .then(res => res.json())
        //     .then(data => 
        //         //@ts-ignore
        //         update({ adminsList: data['admin'] });
        //     });
        //@ts-ignore
        fetchAdminsList(null, (value) => update({ adminsList: value }));
    }
    catch(err) {
        console.error('ERROR while fetching RBAC users: ', err);
    }
    finally {
      if(cb) setTimeout(() => { cb?.() }, 1200);
    }
  };

  const contextValue = React.useMemo(() => ({
    store,
    update,
    fetchAdminUsers,
  }), [store, update]);

  useEffect(() => {
    fetchAdminUsers();
  }, []);

  return (
    <AppStoreContext.Provider value={contextValue}>
      {children}
    </AppStoreContext.Provider>
  );
};

export const useAppStore = () => {
  return React.useContext(AppStoreContext);
};
