import { DEV_ENV_HOST, PROD_ENV_HOST, STAGE_ENV_HOST } from "./constants";

/**
 * @param environment - A string value representing current env from meta. It can be 'dev', 'prod', or 'stage'.
 * @returns - The host name for base URL of highq backend api, depending upon the environment.
 */
export const getApiHost = (environment) => {
    let base_host = DEV_ENV_HOST;
        switch(environment?.toLowerCase?.()) {
          case 'prod':
            base_host = PROD_ENV_HOST;
            break;
          case 'stage':
            base_host = STAGE_ENV_HOST;
            break;
          case 'dev':
          default:
            base_host = DEV_ENV_HOST;
        }
    return base_host;
};