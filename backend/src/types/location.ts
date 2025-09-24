import { LocationType } from '@prisma/client';

export interface LocationFilter {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  locationType?: LocationType;
  isActive?: boolean;
  search?: string;
}

export interface CreateLocationRequest {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  locationType: LocationType;
  clientName?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  operatingHours?: string;
  specialInstructions?: string;
  hazardousArea?: boolean;
  accessRestrictions?: string;
  parkingInstructions?: string;
  unloadingInstructions?: string;
  equipmentAvailable?: string;
}

export interface UpdateLocationRequest {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  locationType?: LocationType;
  clientName?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  operatingHours?: string;
  specialInstructions?: string;
  isActive?: boolean;
  hazardousArea?: boolean;
  accessRestrictions?: string;
  parkingInstructions?: string;
  unloadingInstructions?: string;
  equipmentAvailable?: string;
}