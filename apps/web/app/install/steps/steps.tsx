import AccountCreation from './account_creation'
import DefaultElements from './default_elements'
import DisableInstallMode from './disable_install_mode'
import Finish from './finish'
import GetStarted from './get_started'
import OrgCreation from './org_creation'
import SampleData from './sample_data'

// Define step IDs as constants for better maintainability
export const INSTALL_STEPS_IDS = {
  INSTALL_STATUS: 'INSTALL_STATUS',
  ORGANIZATION_CREATION: 'ORGANIZATION_CREATION',
  DEFAULT_ELEMENTS: 'DEFAULT_ELEMENTS',
  ACCOUNT_CREATION: 'ACCOUNT_CREATION',
  SAMPLE_DATA: 'SAMPLE_DATA',
  FINISH: 'FINISH',
  DISABLING_INSTALLATION_MODE: 'DISABLING_INSTALLATION_MODE',
}

// Type for Step IDs
export type StepId = keyof typeof INSTALL_STEPS_IDS

// Interface for step configuration
export interface InstallStepConfig {
  id: StepId;
  translationKey: `steps.${StepId}`; // Enforce structure for translation keys
  component: React.ReactNode;
  completed: boolean;
}

export const INSTALL_STEPS: InstallStepConfig[] = [
  {
    id: 'INSTALL_STATUS',
    translationKey: 'steps.INSTALL_STATUS',
    component: <GetStarted />,
    completed: false,
  },
  {
    id: 'ORGANIZATION_CREATION',
    translationKey: 'steps.ORGANIZATION_CREATION',
    component: <OrgCreation />,
    completed: false,
  },
  {
    id: 'DEFAULT_ELEMENTS',
    translationKey: 'steps.DEFAULT_ELEMENTS',
    component: <DefaultElements />,
    completed: false,
  },
  {
    id: 'ACCOUNT_CREATION',
    translationKey: 'steps.ACCOUNT_CREATION',
    component: <AccountCreation />,
    completed: false,
  },
  {
    id: 'SAMPLE_DATA',
    translationKey: 'steps.SAMPLE_DATA',
    component: <SampleData />,
    completed: false,
  },
  {
    id: 'FINISH',
    translationKey: 'steps.FINISH',
    component: <Finish />,
    completed: false,
  },
  {
    id: 'DISABLING_INSTALLATION_MODE',
    translationKey: 'steps.DISABLING_INSTALLATION_MODE',
    component: <DisableInstallMode />,
    completed: false,
  },
]
