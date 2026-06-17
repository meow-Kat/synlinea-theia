import { CapabilityItem } from './capability-item';

/**
 * JSON-RPC service path for the capability scanner backend service.
 */
export const CAPABILITY_SCANNER_SERVICE_PATH = '/services/capability-scanner';

/**
 * Token / injection symbol for the capability scanner service.
 */
export const CapabilityScannerService = Symbol('CapabilityScannerService');

/**
 * Backend service: scans skills and rules, builds relationship index,
 * and returns the result to the frontend via RPC.
 */
export interface CapabilityScannerService {
    /**
     * Scan all known skill + rule locations for the given workspace root.
     * Returns the full list of resolved CapabilityItems with refsOut/refsIn filled.
     *
     * @param workspaceRoot Absolute path to the workspace root directory.
     */
    scan(workspaceRoot: string | undefined): Promise<CapabilityItem[]>;
}
