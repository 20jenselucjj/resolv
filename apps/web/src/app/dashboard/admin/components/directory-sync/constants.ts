'use client';

import type { FieldMapping, DirectorySyncConfig, AzureFieldMapping } from './types';

export const DEFAULT_FIELD_MAPPING: FieldMapping = {
  email: 'primaryEmail',
  name: 'name.fullName',
  department: 'department',
  jobTitle: 'title',
  phone: 'phones[0].value',
};

export const DEFAULT_AZURE_FIELD_MAPPING: AzureFieldMapping = {
  displayName: 'name',
  mail: 'email',
  userPrincipalName: 'username',
  department: 'department',
  jobTitle: 'title',
  officeLocation: 'location',
};

export const DEFAULT_CONFIG: DirectorySyncConfig = {
  enabled: false,
  provider: 'google_workspace',
  autoProvision: false,
  defaultRole: 'user',
  syncIntervalMinutes: 60,
  fieldMapping: { ...DEFAULT_FIELD_MAPPING },
  roleMapping: [],
  autoDeactivate: false,
  azureFieldMapping: { ...DEFAULT_AZURE_FIELD_MAPPING },
  groupRoleMapping: {},
};