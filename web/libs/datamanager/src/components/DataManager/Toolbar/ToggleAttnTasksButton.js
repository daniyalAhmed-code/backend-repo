import { inject } from "mobx-react";
import { LsRefresh, LsRefresh2 } from "../../../assets/icons";
import { FF_LOPS_E_10, isFF } from "../../../utils/feature-flags";
import { Button } from "../../Common/Button/Button";
import { useState } from "react";

const isNewUI = isFF(FF_LOPS_E_10);

const injector = inject(({ store }) => {
  return {
    store,
    needsDataFetch: store.needsDataFetch,
    projectFetch: store.projectFetch,
  };
});

export const ToggleAttnTasksButton = injector(({ store, needsDataFetch, projectFetch, size, style, ...rest }) => {
  const [shouldShowAttnTasks, setShouldShowAttnTasks] = useState(localStorage.getItem('show-attn-tasks')?.toLowerCase() == 'true');
  return (
    <Button
      // size={size}
      look={shouldShowAttnTasks && 'primary'}
      waiting={projectFetch}
      onClick={async () => {
        const temp = !shouldShowAttnTasks;
        localStorage.setItem('show-attn-tasks', `${temp}`);
        setShouldShowAttnTasks(temp);
        await store.fetchProject({ force: true, interaction: 'refresh' });
        await store.currentView?.reload();
      }}
      style={{
        ...(style ?? {}),
        // minWidth: 0,
        // padding: 0,
        // width: isNewUI ? 40 : 32,
        minWidth: 'fit-content'
      }}
      {...rest}
    >
      {shouldShowAttnTasks ? "Show All Tasks" : "Filter Attention Tasks"}
    </Button>
  );
});
