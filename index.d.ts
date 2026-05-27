// Type definitions for GhostTrace v3.0.0
// Project: https://github.com/yourusername/ghosttrace
// Definitions by: GhostTrace Team

import { RequestHandler, Request, Response } from 'express';

export interface GhostTraceConfig {
  /** Admin email for auto-creating admin user (optional - use setup page if not provided) */
  adminEmail?: string;
  
  /** Admin password for auto-creating admin user (optional - use setup page if not provided) */
  adminPassword?: string;
  
  /** Dashboard server port (default: 3001) */
  dashboardPort?: number;
  
  /** Proxy port (default: 3002) */
  proxyPort?: number;
  
  /** Risk score threshold for blocking (0-100, default: 70) */
  blockThreshold?: number;
  
  /** Max requests per minute (default: 120) */
  rateLimit?: number;
  
  /** Enable request blocking on threat detection (default: true) */
  blockOnThreat?: boolean;
  
  /** Database configuration (optional - runs in-memory if not provided) */
  database?: DatabaseConfig;
  
  /** AI provider configuration (optional) */
  ai?: AIConfig;

  /** Express app instance (optional, used for route registration) */
  app?: any;

  /** Fail startup if encryption key is missing (default false) */
  requireEncryption?: boolean;

  /** Optional key file path for encryption */
  encryptionKeyPath?: string;
}

export interface DatabaseConfig {
  /** Database type (postgres, mysql, sqlite) */
  type?: 'postgres' | 'mysql' | 'sqlite';
  
  /** Database host */
  host?: string;
  
  /** Database port */
  port?: number;
  
  /** Database name */
  name?: string;
  
  /** Database user */
  user?: string;
  
  /** Database password */
  password?: string;
  
  /** Enable SSL connection */
  ssl?: boolean;
  
  /** Connection pool max size */
  poolMax?: number;
  
  /** Connection pool min size */
  poolMin?: number;
}

export interface AIConfig {
  /** AI provider name (openai, anthropic, gemini, ollama, custom) */
  provider?: string;
  
  /** AI provider API key */
  apiKey?: string;
  
  /** AI model name */
  model?: string;
  
  /** Enable AI analysis */
  enabled?: boolean;
  
  /** Multiple provider configuration with fallback */
  providers?: Array<{
    provider: string;
    apiKey: string;
    model?: string;
    priority?: number;
  }>;
}

export interface SecureOptions {
  /** Risk score threshold for this route (overrides global) */
  riskThreshold?: number;
  
  /** Alternative name for riskThreshold */
  blockThreshold?: number;
  
  /** Rate limit for this route (overrides global) */
  rateLimit?: number;
  
  /** Enable blocking for this route (overrides global) */
  blockOnThreat?: boolean;
  
  /** Paths to skip protection */
  allowlist?: Array<string | RegExp>;
  
  /** Enable behavioral analysis */
  enableAnalysis?: boolean;
  
  /** Max anomalies before blocking */
  anomalyBlockCount?: number;
  
  /** Rate limit window in milliseconds */
  rateLimitWindowMs?: number;
  
  /** Include AI explanation in block response */
  explainOnBlock?: boolean;
  
  /** Passthrough mode (never block, analysis only) */
  passthrough?: boolean;
  
  /** Custom user identification function */
  identifyUser?: (req: Request) => { userId: string; accountId: string };
  
  /** Custom activity mapping function */
  mapActivity?: (req: Request) => any;
  
  /** Custom threat handler */
  onThreat?: (req: Request, res: Response, analysis: ThreatAnalysis) => void | Promise<void>;
}

export interface ThreatAnalysis {
  /** Whether this is classified as a threat */
  isThreat: boolean;
  
  /** Risk score (0-100) */
  riskScore: number;
  
  /** Threat level (low, medium, high, critical) */
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  
  /** Detected anomalies */
  anomalies: Array<{
    type: string;
    severity: string;
    description?: string;
  }>;
  
  /** AI-generated explanation */
  explanation?: {
    explanation: string;
    actions: string[];
  };
  
  /** Profile key for this entity */
  profileKey?: string;
  
  /** Error flag */
  error?: boolean;
  
  /** Error message if error occurred */
  message?: string;
}

export interface GhostTraceInstance {
  /** Configuration used for initialization */
  config: GhostTraceConfig;
  
  /** Dashboard HTTP server instance */
  dashboardServer: any;
  
  /** Stop GhostTrace and close all connections */
  stop: () => Promise<void>;
}

/**
 * Initialize GhostTrace security layer
 * 
 * Zero configuration mode (recommended):
 *   await ghosttrace.init();
 *   Then visit http://localhost:3001 to create admin account
 * 
 * With options:
 *   await ghosttrace.init({ adminEmail: '...', adminPassword: '...' });
 * 
 * @param config Configuration options (all optional)
 * @returns Promise resolving to GhostTrace instance
 */
export function init(config?: GhostTraceConfig): Promise<GhostTraceInstance>;

/**
 * Create Express middleware for route protection
 * @param options Route-specific security options
 * @returns Express middleware function
 */
export function secure(options?: SecureOptions): RequestHandler;

/**
 * Current GhostTrace version
 */
export const version: string;

/**
 * Default export with all methods
 */
declare const ghosttrace: {
  init: typeof init;
  secure: typeof secure;
  version: string;
};

export default ghosttrace;

/**
 * Augment Express Request with GhostTrace properties
 */
declare global {
  namespace Express {
    interface Request {
      /** Client behavioral DNA fingerprint */
      clientDNA?: string;
      
      /** Detailed DNA object */
      clientDNAObj?: {
        features: any;
      };
      
      /** Threat analysis results */
      protectionAnalysis?: ThreatAnalysis;
      
      /** Profile key for this entity */
      clientDNAKey?: string;
    }
  }
}
