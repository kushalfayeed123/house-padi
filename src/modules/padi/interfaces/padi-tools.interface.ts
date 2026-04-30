export enum PadiToolName {
  // Discovery & Applications
  SEARCH_PROPERTIES = 'SEARCH_PROPERTIES',
  CREATE_APPLICATION = 'CREATE_APPLICATION', // Handles Tours & Instant Rent
  GET_USER_APPLICATIONS = 'GET_USER_APPLICATIONS',

  // Owner Operations
  UPDATE_APPLICATION_STATUS = 'UPDATE_APPLICATION_STATUS', // Approve/Decline[cite: 1]
  GET_OWNER_DASHBOARD = 'GET_OWNER_DASHBOARD', // For landlords[cite: 1]

  // Lease & Payments
  GET_RENTAL_STATUS = 'GET_RENTAL_STATUS', // Get active leases[cite: 2]
  PREPARE_LEASE = 'PREPARE_LEASE', // Generate PDF[cite: 2]
  COMPLETE_RENTAL = 'COMPLETE_RENTAL', // Payment logic
  DECLINE_LEASE = 'DECLINE_LEASE', // Reject offer[cite: 2]

  // Listing
  START_PROPERTY_LISTING = 'START_PROPERTY_LISTING',
}

export interface PadiExecutionPlan {
  thought?: string;
  toolCalls?: {
    name: PadiToolName;
    arguments: any;
  }[];
}

export interface PadiToolCall {
  name: PadiToolName; // This ensures the tool name is typed as the enum
  arguments: any;
}

export interface PadiExecutionPlan {
  thought?: string;
  toolCalls?: PadiToolCall[];
}
