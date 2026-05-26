'use client';

import type { FieldMapping, DirectorySyncConfig } from './types';

export const DEFAULT_FIELD_MAPPING: FieldMapping = {
  email: 'primaryEmail',
  name: 'name.fullName',
  department: 'department',
  jobTitle: 'title',
  phone: 'phones[0].value',
};

export const DEFAULT_CONFIG: DirectorySyncConfig = {
  enabled: false,
  provider: 'google_workspace',
  autoProvision: false,
  defaultRole: 'user',
  syncIntervalMinutes: 60,
  fieldMapping: { ...DEFAULT_FIELD_MAPPING },
  roleMapping: [],
};