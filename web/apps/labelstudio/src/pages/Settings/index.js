import React from 'react';
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu';
import { WebhookPage } from '../WebhookPage/WebhookPage';
import { DangerZone } from './DangerZone';
import { GeneralSettings } from './GeneralSettings';
import { InstructionsSettings } from './InstructionsSettings';
import { LabelingSettings } from './LabelingSettings';
import { MachineLearningSettings } from './MachineLearningSettings/MachineLearningSettings';
import { StorageSettings } from './StorageSettings/StorageSettings';
import { ProjectLabelsSettings } from './ProjectLabelsSettings';


export const MenuLayout = ({ children, ...routeProps }) => {
  return (
    <SidebarMenu
      menuItems={[
        GeneralSettings,
        // LabelingSettings,
        ProjectLabelsSettings,
        InstructionsSettings,
        MachineLearningSettings,
        StorageSettings,
        WebhookPage,
        DangerZone,
      ]}
      path={routeProps.match.url}
      children={children}
    />
  );
};

export const SettingsPage = {
  title: "Settings",
  path: "/settings",
  exact: true,
  layout: MenuLayout,
  component: GeneralSettings,
  pages: {
    InstructionsSettings,
    // LabelingSettings,
    ProjectLabelsSettings,
    MachineLearningSettings,
    StorageSettings,
    WebhookPage,
    DangerZone,
  },
};
